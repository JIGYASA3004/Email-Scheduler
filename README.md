# Outbox — email scheduler service + dashboard

A small, production-shaped email scheduler: an Express + TypeScript API, a BullMQ worker backed by Redis,
PostgreSQL for durable state, Ethereal for fake SMTP, and a React + Bootstrap dashboard with real Google sign-in.

```
email-scheduler/
├── docker-compose.yml        Postgres 16 + Redis 7 (AOF on)
├── server/                   API + worker (same codebase, chosen with --role)
│   ├── scripts/flood.ts      load demo: N emails "right now" on one sender
│   └── src/
│       ├── main.ts           boot: schema → senders → api and/or worker → graceful shutdown
│       ├── settings.ts       every tunable, read from env
│       ├── httpApp.ts        express app, routes, static SPA (prod)
│       ├── infra/            postgres pool + schema, redis connection
│       ├── identity/         Google OAuth code flow, signed session cookie, accounts
│       ├── outbox/           batch planning (DB + enqueue), folder listing/search, HTTP endpoints
│       └── delivery/         queue, Lua throttle, job runner, Ethereal sender pool
└── web/                      Vite + React 19 + Bootstrap 5
    └── src/
        ├── boot.tsx, Root.tsx
        ├── model.ts          API types
        ├── net/              fetch wrapper + typed endpoints
        ├── hooks/            useFetched (load/poll), useHashView (tab in URL)
        ├── kit/              reusable UI: Action, Dialog, Glyph, Portrait, StateTag, Blank, Notice (toasts)
        ├── util/             address harvesting, time formatting
        └── views/            Welcome, TopBar, Overview, DeliveryTable, ComposeDialog, LeadDrop
```

Minimal dependencies on purpose. Server: `express`, `bullmq`, `ioredis`, `pg` and `nodemailer`.
There's no ORM, no passport, no JWT or cookie libraries (HMAC-signed cookie via `node:crypto`), and no dotenv (`node --env-file`).
Web: `react`, `react-dom` and `bootstrap` (CSS only, so no Bootstrap JS).

---

## 1. Running it

Requirements: Node 22+, Docker.

```bash
# 1) infrastructure
docker compose up -d                      # Postgres on :5442, Redis on :6390

# 2) backend
cd server
cp .env.example .env                      # fill GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / SESSION_SECRET
npm install
npm run dev                               # API + worker in one process on :4100
#   or run them separately (what you'd do in production / for the restart demo):
npm run dev:api
npm run dev:worker                        # start as many as you like

# 3) frontend
cd ../web
npm install
npm run dev                               # http://localhost:5180 (proxies /api and /auth to :4100)
```

Production build: `cd web && npm run build`, then `cd server && npm run build && npm start`. The API serves `web/dist`
on the same origin.

### Google OAuth
1. Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* → *Web application*.
2. Authorised redirect URI: `http://localhost:5180/auth/google/callback` (the Vite proxy forwards it to the API).
3. Put the client id/secret in `server/.env`. Scopes used: `openid email profile`.

### Ethereal (fake SMTP)
Nothing to set up. On first boot the server creates `ETHEREAL_SENDER_COUNT` (default 3) Ethereal inboxes through
Ethereal's API and **stores them in Postgres**, so the same senders are reused after restarts. To use your own
accounts, set `ETHEREAL_ACCOUNTS=user1@ethereal.email:pass1;user2@ethereal.email:pass2`.
Every sent row has a link icon that opens the captured message on ethereal.email.

### Environment variables (`server/.env`)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 4100 | API port |
| `APP_URL` | http://localhost:5180 | where OAuth redirects back to |
| `SESSION_SECRET` | – | HMAC key for session cookies |
| `DATABASE_URL` / `REDIS_URL` | compose defaults | storage |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | – | Google OAuth |
| `WORKER_CONCURRENCY` | 5 | BullMQ jobs processed in parallel per worker process |
| `MIN_SEND_GAP_MS` | 2000 | minimum time between two sends **from the same sender** |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | 200 | hard hourly ceiling per sender |
| `SEND_ATTEMPTS` | 3 | SMTP retries (exponential backoff from 5 s) |
| `ETHEREAL_SENDER_COUNT` / `ETHEREAL_ACCOUNTS` | 3 / empty | sender pool |

---

## 2. Architecture

```
 browser ──► Vite (:5180) ──proxy──► API (:4100) ──► Postgres  (batches, deliveries, accounts, senders)
                                         │
                                         └──► Redis / BullMQ "outbound-mail"  (one delayed job per delivery)
                                                     ▲
                                 worker(s) ──────────┘──► Lua throttle (Redis) ──► Ethereal SMTP
```

### How scheduling works
1. `POST /api/batches` validates input and, **in one transaction**, inserts a `batch` row and one `delivery` row per
   recipient. Recipient *i* gets `due_at = startsAt + i × delay`.
2. After commit, one BullMQ job per delivery is added with `delay = due_at − now` and **`jobId = delivery.id`**.
   There is no cron anywhere. BullMQ's delayed set in Redis is the timer.
3. When a job fires, the worker:
   1. loads the row. If it's already `sent`/`failed`, it does nothing (idempotent re-run).
   2. asks the **throttle** (a Redis Lua script) for a send slot (see §3).
      - *granted, slot ≈ now* → continue.
      - *granted, slot in the future* (gap) → `job.moveToDelayed(slot)` and re-run then.
      - *denied* (hourly cap) → mark `throttled`, `moveToDelayed(next hour)`. This is not a failure and uses no retry.
   3. **claims** the row with a conditional `UPDATE … SET state='sending' WHERE state IN ('scheduled','throttled')`.
      Only one process can win.
   4. sends through the sender's SMTP transport with a deterministic `Message-ID` (`<delivery-id@mail-scheduler.local>`),
      then marks it `sent` and stores Ethereal's preview URL.
   5. on SMTP error it goes back to `scheduled` (BullMQ retries) or to `failed` on the last attempt.

States: `scheduled → (throttled) → sending → sent | failed`.

### Persistence across restarts
- **Postgres is the source of truth**: every email exists as a row before any job exists.
- **Redis keeps the timers.** Delayed jobs live in Redis (AOF enabled in compose), so stopping the API/worker loses nothing.
  On restart the worker simply continues. Jobs whose time passed while it was down run immediately, once.
- **Reconcile on worker boot.** The worker re-adds a job for every unfinished row. Because `jobId = delivery.id`, jobs
  that still exist are untouched (no duplicates). Only jobs that were really lost get recreated, e.g. after Redis was
  wiped or an enqueue failed after the DB commit.
- **Graceful shutdown** (`SIGINT`/`SIGTERM`): `worker.close()` waits for in-flight sends before exiting.
- **Crash mid-send**: BullMQ's stalled-job check hands the job to another worker. Our claim refuses a fresh `sending`
  row and re-checks after a 60 s claim TTL, then takes over.

### Idempotency (no email sent twice)
| Layer | Mechanism |
|---|---|
| HTTP | compose sends an `Idempotency-Key`. `UNIQUE(owner_id, request_key)` turns a double-submit into a replay of the first batch |
| DB | `UNIQUE(batch_id, recipient)`, so duplicate leads in one batch collapse |
| Queue | `jobId = delivery.id`, so re-enqueueing is a no-op |
| Worker | `sent`/`failed` rows are skipped. The conditional claim lets exactly one runner send |
| SMTP | deterministic `Message-ID`, so in the one unavoidable edge case (process dies after SMTP accepted but before the DB update) a resend is recognisable downstream |

---

## 3. Rate limiting, delay & concurrency

All enforcement lives in **one atomic Lua script** (`server/src/delivery/throttle.ts`), so it's correct across any
number of worker processes or machines. Nothing relies on in-memory counters.

Keys per sender (hash-tagged, so they're Cluster-safe):

| Key | Purpose |
|---|---|
| `throttle:{mbx:N}:next` | earliest time the sender may send again (enforces the gap) |
| `throttle:{mbx:N}:hour:<window>` | sends by this sender in clock-hour `<window>` |
| `throttle:{mbx:N}:batch:<id>:hour:<window>` | sends by this batch in that hour (the compose "Hourly limit") |
| `throttle:{mbx:N}:overflow:<window>` | position counter for jobs deferred into `<window>` |

- **Delay between emails:** the effective gap is `max(MIN_SEND_GAP_MS, batch delay)`, **default minimum 2 s per sender**.
  A granted slot moves the sender's `next` pointer forward by the gap. Different senders send in parallel.
- **Emails per hour:** a send needs `sender count < MAX_EMAILS_PER_HOUR_PER_SENDER` **and** `batch count < batch limit`
  in the current clock hour. When either is full the job is **not dropped or failed**. It's put to sleep until the
  start of the next hour, offset by `position × gap` in that hour's overflow line. That keeps the original order
  (FIFO) and avoids a thundering herd at :00. If the next hour fills up too, the job just rolls forward again.
- **Concurrency:** `WORKER_CONCURRENCY` jobs run in parallel per process, and you can run several `--role=worker`
  processes. Parallel jobs are safe because slot reservation is atomic in Redis, the row claim is atomic in Postgres,
  and each sender reuses one cached SMTP transport.

**Trade-off:** I didn't use BullMQ's built-in `limiter`. It's per-queue (global) and can't express per-sender plus
per-batch hourly windows. The Lua approach costs one Redis round trip per job and wastes no retry attempts.

### Behaviour under load (1000+ emails at the same moment)
- Scheduling is a single multi-row `INSERT … SELECT unnest(...)` plus `addBulk` in chunks of 500, so it takes
  milliseconds per thousand.
- When they fire, each job reserves the next slot for its sender: about one send every 2 s per sender, until the hourly
  cap. The rest show as **Rate limited** in the dashboard with their new time. They flow out hour by hour, in order.
- Try it: `cd server && npm run flood -- 1000 50` (1000 emails, 50/hour), then watch the dashboard.

---

## 4. API

| Method | Path | Notes |
|---|---|---|
| GET | `/auth/google` → `/auth/google/callback` | Google OAuth code flow, sets the `sid` cookie |
| POST | `/auth/logout` | |
| GET | `/api/me` | `{ id, email, name, picture }` |
| GET | `/api/mailboxes` | senders + sends used this hour |
| POST | `/api/batches` | `{ mailboxId, subject, body, recipients[], startsAt?, gapSeconds?, hourlyCap? }`, optional `Idempotency-Key` header |
| GET | `/api/folders/scheduled \| sent?q=&limit=&offset=` | list + search (Postgres full-text on subject/body, substring on recipient/subject) |
| GET | `/api/totals` | counts per folder |

---

## 5. Features → requirements

**Backend**
- [x] Express + TypeScript API, Postgres (raw SQL via `pg`), BullMQ on Redis, Ethereal SMTP
- [x] Delayed-job scheduling, no cron
- [x] Multiple senders (Ethereal pool, persisted)
- [x] Persistence and correct timing across restarts, with boot-time reconcile
- [x] Idempotency at the HTTP, DB, queue, worker and SMTP layers
- [x] Configurable worker concurrency
- [x] Minimum delay between sends (per sender, 2 s default)
- [x] Hourly limit per sender (env) plus per batch (UI), using Redis counters; overflow is rescheduled in order, never dropped
- [x] Search over scheduled and sent emails

**Frontend**
- [x] Real Google OAuth login, then redirect to the dashboard
- [x] Top navbar with name, email, avatar and logout
- [x] Stat cards, Scheduled / Sent tabs, primary **Compose New Email** button
- [x] Compose modal: sender, subject, body, CSV/TXT upload (drag & drop) or paste with a live count of detected addresses, start time (+ quick presets), delay, hourly limit
- [x] Tables: email, subject, scheduled/sent time, status. Loading skeletons, empty states and error states with retry
- [x] Toast notifications, auto-refresh every 5 s, search box
- [x] Typed API layer, reusable components, Bootstrap styling, responsive down to phone width

---

## 6. Assumptions, shortcuts & trade-offs
- **Search uses Postgres instead of Elasticsearch.** I chose this to keep the stack small. Full-text
  (`to_tsvector`/`websearch_to_tsquery`) plus `ILIKE` covers this scale. Swapping in ES would only touch `outbox/plan.ts`.
- **Slack notifications are not included.** The rate-limit event is logged by the worker and shown as *Rate limited*
  in the UI.
- **There's no Bull Board UI.** Queue state shows in the app's Scheduled and Sent tabs. To inspect raw jobs, use Redis
  directly, e.g. `redis-cli ZCARD bull:outbound-mail:delayed`.
- **The UI doesn't follow the Figma.** It's a Bootstrap dashboard of its own: top navbar, stat cards, tabs, table and compose modal.
- **Hour windows are clock hours (UTC)**, not a sliding 60 minutes. That's simpler to reason about and to show.
- **The email body is plain text.** No rich-text editor or attachments.
- **The schema is applied on boot** with `CREATE TABLE IF NOT EXISTS`, which is enough here. A real service would
  use a migration tool.
- **At-least-once at the SMTP boundary:** if a process dies after the SMTP server accepted a message but before the
  DB update, that one message can be resent after the claim TTL. It carries the same `Message-ID`.
- **Only Google sign-in.** There is no email/password login.

## 7. Demo script (restart scenario)
1. `npm run dev:api` and `npm run dev:worker` in two terminals. Log in and compose 3–5 emails starting **in 5 min**.
2. Stop the worker (Ctrl+C), and the API too if you like. The jobs stay in Redis as delayed jobs; the dashboard (API running) still lists them under **Scheduled**.
3. Start the worker again before or after the due time. The log shows `reconciled N pending deliveries`. The emails
   go out once, on time (or immediately if their time passed while it was down), and appear under **Sent**.
4. Bonus: `npm run flood -- 300 20` and watch *Rate limited* rows roll into the next hour windows.
