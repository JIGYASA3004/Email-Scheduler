import nodemailer, { type Transporter } from 'nodemailer';
import { settings } from '../settings';
import { pg } from '../infra/postgres';

export interface Mailbox {
  id: number;
  address: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
}

const ETHEREAL_HOST = 'smtp.ethereal.email';
const ETHEREAL_PORT = 587;
const PROVISION_LOCK = 72_311; // arbitrary pg advisory lock id

/**
 * Asks Ethereal for a brand-new inbox. (nodemailer.createTestAccount() caches one account
 * per process, which would hand us the same inbox for every sender.)
 */
async function freshEtherealAccount(): Promise<{ user: string; pass: string; smtp: { host: string; port: number } }> {
  const res = await fetch('https://api.nodemailer.com/user', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requestor: 'mail-scheduler', version: '1.0.0' }),
  });
  const data = await res.json();
  if (!res.ok || data.status !== 'success') throw new Error(`Ethereal account creation failed: ${data.error ?? res.status}`);
  return data;
}

/**
 * Makes sure the sender pool exists. Accounts are stored in Postgres so the same
 * Ethereal inboxes are reused across restarts. An advisory lock keeps the API and
 * worker processes from creating accounts twice when they boot together.
 */
export async function provisionMailboxes(): Promise<void> {
  const conn = await pg.connect();
  try {
    await conn.query('SELECT pg_advisory_lock($1)', [PROVISION_LOCK]);

    for (const pair of settings.ethereal.presets.split(/[;\s]+/).filter(Boolean)) {
      const [user, pass] = pair.split(':');
      if (!user || !pass) continue;
      await conn.query(
        `INSERT INTO mailbox (address, smtp_host, smtp_port, smtp_user, smtp_pass)
         VALUES ($1, $2, $3, $1, $4) ON CONFLICT (address) DO NOTHING`,
        [user, ETHEREAL_HOST, ETHEREAL_PORT, pass],
      );
    }

    const { rows } = await conn.query<{ n: number }>('SELECT count(*)::int AS n FROM mailbox');
    for (let i = rows[0].n; i < settings.ethereal.count; i++) {
      const acct = await freshEtherealAccount();
      await conn.query(
        `INSERT INTO mailbox (address, smtp_host, smtp_port, smtp_user, smtp_pass)
         VALUES ($1, $2, $3, $1, $4)`,
        [acct.user, acct.smtp.host, acct.smtp.port, acct.pass],
      );
      console.log(`[mailbox] created Ethereal sender ${acct.user}`);
    }
  } finally {
    await conn.query('SELECT pg_advisory_unlock($1)', [PROVISION_LOCK]).catch(() => undefined);
    conn.release();
  }
}

export async function listMailboxes(): Promise<Pick<Mailbox, 'id' | 'address'>[]> {
  const { rows } = await pg.query('SELECT id, address FROM mailbox ORDER BY id');
  return rows;
}

const transports = new Map<number, Transporter>();

export async function transportFor(mailboxId: number): Promise<Transporter> {
  const cached = transports.get(mailboxId);
  if (cached) return cached;
  const { rows } = await pg.query<Mailbox>('SELECT * FROM mailbox WHERE id = $1', [mailboxId]);
  const box = rows[0];
  if (!box) throw new Error(`Mailbox ${mailboxId} not found`);
  const transport = nodemailer.createTransport({
    host: box.smtp_host,
    port: box.smtp_port,
    secure: box.smtp_port === 465,
    auth: { user: box.smtp_user, pass: box.smtp_pass },
  });
  transports.set(mailboxId, transport);
  return transport;
}
