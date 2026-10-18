import { Pool, PoolClient } from 'pg';
import { settings } from '../settings';

export const pg = new Pool({ connectionString: settings.databaseUrl, max: 10 });

// Idempotent DDL, applied on every boot (no migration tool needed for this size).
const SCHEMA = `
CREATE TABLE IF NOT EXISTS account (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub  text UNIQUE NOT NULL,
  email       text NOT NULL,
  full_name   text NOT NULL DEFAULT '',
  picture     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mailbox (
  id         serial PRIMARY KEY,
  address    text UNIQUE NOT NULL,
  smtp_host  text NOT NULL,
  smtp_port  int  NOT NULL,
  smtp_user  text NOT NULL,
  smtp_pass  text NOT NULL
);

CREATE TABLE IF NOT EXISTS batch (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  mailbox_id    int  NOT NULL REFERENCES mailbox(id),
  subject       text NOT NULL,
  body          text NOT NULL,
  starts_at     timestamptz NOT NULL,
  gap_seconds   int NOT NULL,
  hourly_cap    int NOT NULL,
  request_key   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, request_key)
);

CREATE TABLE IF NOT EXISTS delivery (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id     uuid NOT NULL REFERENCES batch(id) ON DELETE CASCADE,
  owner_id     uuid NOT NULL,
  recipient    text NOT NULL,
  state        text NOT NULL DEFAULT 'scheduled'
               CHECK (state IN ('scheduled', 'throttled', 'sending', 'sent', 'failed')),
  due_at       timestamptz NOT NULL,
  sent_at      timestamptz,
  tries        int NOT NULL DEFAULT 0,
  last_error   text,
  preview_url  text,
  claimed_at   timestamptz,
  UNIQUE (batch_id, recipient)
);

CREATE INDEX IF NOT EXISTS delivery_owner_state_due ON delivery (owner_id, state, due_at);
`;

export async function applySchema(): Promise<void> {
  await pg.query(SCHEMA);
}

export async function inTransaction<T>(work: (tx: PoolClient) => Promise<T>): Promise<T> {
  const tx = await pg.connect();
  try {
    await tx.query('BEGIN');
    const result = await work(tx);
    await tx.query('COMMIT');
    return result;
  } catch (err) {
    await tx.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    tx.release();
  }
}
