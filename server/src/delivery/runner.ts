import { DelayedError, Worker, type Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { settings } from '../settings';
import { openKv } from '../infra/kv';
import { pg } from '../infra/postgres';
import { transportFor } from './mailboxes';
import { enqueueDeliveries, type DeliveryJob } from './queue';
import { reserveSlot } from './throttle';

const EARLY_TOLERANCE_MS = 500;

interface DeliveryRow {
  id: string;
  batch_id: string;
  recipient: string;
  state: string;
  claimed_at: Date | null;
  mailbox_id: number;
  sender: string;
  subject: string;
  body: string;
  gap_seconds: number;
  hourly_cap: number;
}

async function loadDelivery(id: string): Promise<DeliveryRow | undefined> {
  const { rows } = await pg.query<DeliveryRow>(
    `SELECT d.id, d.batch_id, d.recipient, d.state, d.claimed_at,
            b.mailbox_id, m.address AS sender, b.subject, b.body, b.gap_seconds, b.hourly_cap
       FROM delivery d
       JOIN batch b   ON b.id = d.batch_id
       JOIN mailbox m ON m.id = b.mailbox_id
      WHERE d.id = $1`,
    [id],
  );
  return rows[0];
}

/** Puts the job back to sleep until `at` without spending a retry attempt. */
async function sleepUntil(job: Job<DeliveryJob>, token: string | undefined, at: number): Promise<never> {
  await job.moveToDelayed(at, token);
  throw new DelayedError();
}

async function deliver(job: Job<DeliveryJob>, token?: string) {
  const row = await loadDelivery(job.data.deliveryId);
  if (!row) return { skipped: 'deleted' };
  if (row.state === 'sent' || row.state === 'failed') return { skipped: row.state }; // idempotent re-run

  // 1. Throttle: get (or reuse) a send slot honouring the gap and both hourly caps.
  let slot = job.data.slot;
  if (slot === undefined) {
    const r = await reserveSlot({
      mailboxId: row.mailbox_id,
      batchId: row.batch_id,
      gapMs: Math.max(settings.delivery.minGapMs, row.gap_seconds * 1000),
      senderCap: settings.delivery.maxPerHourPerSender,
      batchCap: Math.min(row.hourly_cap, settings.delivery.maxPerHourPerSender),
    });

    if (!r.granted) {
      // Hourly limit reached: nothing consumed, job sleeps into the next hour window (never dropped).
      await pg.query(
        `UPDATE delivery SET due_at = $2, state = 'throttled' WHERE id = $1 AND state IN ('scheduled', 'throttled')`,
        [row.id, new Date(r.wakeAt)],
      );
      console.log(`[throttle] hourly limit reached for ${row.sender}; ${row.recipient} deferred to ${new Date(r.wakeAt).toISOString()}`);
      await sleepUntil(job, token, r.wakeAt);
    }

    slot = (r as { slot: number }).slot;
    await job.updateData({ ...job.data, slot });
    if (slot > Date.now() + EARLY_TOLERANCE_MS) {
      await pg.query(`UPDATE delivery SET due_at = $2 WHERE id = $1 AND state IN ('scheduled', 'throttled')`, [row.id, new Date(slot)]);
    }
  }
  if (slot > Date.now() + EARLY_TOLERANCE_MS) await sleepUntil(job, token, slot);

  // 2. Claim the row. Only one process can flip it to 'sending'.
  const claim = await pg.query(
    `UPDATE delivery SET state = 'sending', claimed_at = now(), tries = tries + 1
      WHERE id = $1
        AND (state IN ('scheduled', 'throttled')
             OR (state = 'sending' AND claimed_at < now() - make_interval(secs => $2)))
      RETURNING id`,
    [row.id, settings.delivery.claimTtlMs / 1000],
  );
  if (claim.rowCount === 0) {
    const fresh = await loadDelivery(row.id);
    if (!fresh || fresh.state === 'sent' || fresh.state === 'failed') return { skipped: fresh?.state ?? 'deleted' };
    // Someone else holds a live claim (e.g. a crashed worker's stalled job). Check back after the TTL.
    const retryAt = (fresh.claimed_at?.getTime() ?? Date.now()) + settings.delivery.claimTtlMs + 1000;
    await sleepUntil(job, token, retryAt);
  }

  // 3. Send. The Message-ID is derived from the row id so any duplicate is recognisable downstream.
  try {
    const transport = await transportFor(row.mailbox_id);
    const info = await transport.sendMail({
      from: row.sender,
      to: row.recipient,
      subject: row.subject,
      text: row.body,
      messageId: `<${row.id}@mail-scheduler.local>`,
    });
    const preview = nodemailer.getTestMessageUrl(info) || null;
    await pg.query(
      `UPDATE delivery SET state = 'sent', sent_at = now(), preview_url = $2, last_error = NULL WHERE id = $1`,
      [row.id, preview],
    );
    return { sent: true, preview };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    await pg.query(
      `UPDATE delivery SET state = $2, last_error = $3, claimed_at = NULL WHERE id = $1`,
      [row.id, finalAttempt ? 'failed' : 'scheduled', message],
    );
    await job.updateData({ deliveryId: row.id }); // retry must reserve a fresh slot
    throw err;
  }
}

/**
 * Re-enqueues every unfinished delivery. Jobs already in Redis keep their jobId, so this only
 * recreates jobs that were lost (e.g. Redis wiped, or enqueue failed after the DB commit).
 */
export async function reconcile(): Promise<void> {
  const { rows } = await pg.query<{ id: string; due_at: Date }>(
    `SELECT id, due_at FROM delivery WHERE state IN ('scheduled', 'throttled', 'sending') ORDER BY due_at`,
  );
  await enqueueDeliveries(rows);
  console.log(`[worker] reconciled ${rows.length} pending deliveries with the queue`);
}

export function startWorker(): Worker<DeliveryJob> {
  const worker = new Worker<DeliveryJob>(settings.delivery.queueName, deliver, {
    connection: openKv(),
    concurrency: settings.delivery.concurrency,
  });
  worker.on('failed', (job, err) => {
    if (job && !(err instanceof DelayedError)) console.warn(`[worker] job ${job.id} failed: ${err.message}`);
  });
  worker.on('error', (err) => console.error('[worker] error', err));
  console.log(`[worker] listening on "${settings.delivery.queueName}" with concurrency ${settings.delivery.concurrency}`);
  return worker;
}
