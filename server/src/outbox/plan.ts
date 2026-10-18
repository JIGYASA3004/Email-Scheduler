import { inTransaction, pg } from '../infra/postgres';
import { enqueueDeliveries } from '../delivery/queue';

export interface BatchDraft {
  mailboxId: number;
  subject: string;
  body: string;
  recipients: string[];
  startsAt: Date;
  gapSeconds: number;
  hourlyCap: number;
  requestKey?: string;
}

export interface PlanOutcome {
  batchId: string;
  queued: number;
  replayed: boolean;
}

/**
 * Persists a batch and one delivery row per recipient (staggered by gapSeconds),
 * then enqueues delayed jobs. A repeated requestKey returns the original batch untouched.
 */
export async function planBatch(ownerId: string, draft: BatchDraft): Promise<PlanOutcome> {
  const outcome = await inTransaction(async (tx) => {
    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO batch (owner_id, mailbox_id, subject, body, starts_at, gap_seconds, hourly_cap, request_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (owner_id, request_key) DO NOTHING
       RETURNING id`,
      [ownerId, draft.mailboxId, draft.subject, draft.body, draft.startsAt, draft.gapSeconds, draft.hourlyCap, draft.requestKey ?? null],
    );

    if (inserted.rowCount === 0) {
      const prior = await tx.query<{ id: string; n: number }>(
        `SELECT b.id, (SELECT count(*)::int FROM delivery d WHERE d.batch_id = b.id) AS n
           FROM batch b WHERE b.owner_id = $1 AND b.request_key = $2`,
        [ownerId, draft.requestKey],
      );
      return { batchId: prior.rows[0].id, rows: [], replayed: true, count: prior.rows[0].n };
    }

    const batchId = inserted.rows[0].id;
    const t0 = draft.startsAt.getTime();
    const dueTimes = draft.recipients.map((_, i) => new Date(t0 + i * draft.gapSeconds * 1000));
    const rows = await tx.query<{ id: string; due_at: Date }>(
      `INSERT INTO delivery (batch_id, owner_id, recipient, due_at)
       SELECT $1, $2, r, d FROM unnest($3::text[], $4::timestamptz[]) AS t(r, d)
       ON CONFLICT (batch_id, recipient) DO NOTHING
       RETURNING id, due_at`,
      [batchId, ownerId, draft.recipients, dueTimes],
    );
    return { batchId, rows: rows.rows, replayed: false, count: rows.rowCount ?? 0 };
  });

  if (outcome.rows.length) {
    try {
      await enqueueDeliveries(outcome.rows);
    } catch (err) {
      // Rows are committed; the worker's boot-time reconcile will enqueue them.
      console.error('[plan] enqueue failed, will be recovered by reconcile', err);
    }
  }
  return { batchId: outcome.batchId, queued: outcome.count, replayed: outcome.replayed };
}

export type Folder = 'scheduled' | 'sent';

const FOLDER_STATES: Record<Folder, string[]> = {
  scheduled: ['scheduled', 'throttled', 'sending'],
  sent: ['sent', 'failed'],
};

export interface FolderQuery {
  folder: Folder;
  search?: string;
  limit: number;
  offset: number;
}

/** Lists a user's deliveries. Search uses Postgres full-text on subject/body plus a substring match on the recipient. */
export async function browseFolder(ownerId: string, q: FolderQuery) {
  const order = q.folder === 'scheduled' ? 'd.due_at ASC, d.id' : 'COALESCE(d.sent_at, d.due_at) DESC, d.id';
  const params: unknown[] = [ownerId, FOLDER_STATES[q.folder]];
  let filter = '';
  if (q.search) {
    params.push(q.search, `%${q.search.replace(/[%_\\]/g, '\\$&')}%`);
    filter = `AND (to_tsvector('simple', b.subject || ' ' || b.body) @@ websearch_to_tsquery('simple', $3)
                   OR d.recipient ILIKE $4 OR b.subject ILIKE $4)`;
  }
  params.push(q.limit, q.offset);
  const n = params.length;

  const { rows } = await pg.query(
    `SELECT d.id, d.recipient, d.state, d.due_at, d.sent_at, d.last_error, d.preview_url,
            b.subject, left(b.body, 140) AS snippet, m.address AS sender,
            count(*) OVER()::int AS total
       FROM delivery d
       JOIN batch b   ON b.id = d.batch_id
       JOIN mailbox m ON m.id = b.mailbox_id
      WHERE d.owner_id = $1 AND d.state = ANY($2) ${filter}
      ORDER BY ${order}
      LIMIT $${n - 1} OFFSET $${n}`,
    params,
  );

  return {
    total: rows[0]?.total ?? 0,
    items: rows.map((r) => ({
      id: r.id,
      recipient: r.recipient,
      subject: r.subject,
      snippet: r.snippet,
      sender: r.sender,
      state: r.state,
      dueAt: r.due_at,
      sentAt: r.sent_at,
      error: r.last_error,
      previewUrl: r.preview_url,
    })),
  };
}

/** One delivery with its full body, for the reading view. Scoped to the owner. */
export async function readDelivery(ownerId: string, id: string) {
  const { rows } = await pg.query(
    `SELECT d.id, d.recipient, d.state, d.due_at, d.sent_at, d.last_error, d.preview_url,
            b.subject, b.body, m.address AS sender
       FROM delivery d
       JOIN batch b   ON b.id = d.batch_id
       JOIN mailbox m ON m.id = b.mailbox_id
      WHERE d.owner_id = $1 AND d.id = $2`,
    [ownerId, id],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    recipient: r.recipient,
    subject: r.subject,
    body: r.body,
    sender: r.sender,
    state: r.state,
    dueAt: r.due_at,
    sentAt: r.sent_at,
    error: r.last_error,
    previewUrl: r.preview_url,
  };
}

export async function folderTotals(ownerId: string): Promise<Record<Folder, number>> {
  const { rows } = await pg.query<{ scheduled: number; sent: number }>(
    `SELECT count(*) FILTER (WHERE state IN ('scheduled', 'throttled', 'sending'))::int AS scheduled,
            count(*) FILTER (WHERE state IN ('sent', 'failed'))::int AS sent
       FROM delivery WHERE owner_id = $1`,
    [ownerId],
  );
  return rows[0];
}
