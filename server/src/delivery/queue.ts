import { Queue } from 'bullmq';
import { settings } from '../settings';
import { kv } from '../infra/kv';

export interface DeliveryJob {
  deliveryId: string;
  /** Send slot (epoch ms) already reserved by the throttle; absent until reserved. */
  slot?: number;
}

export const deliveryQueue = new Queue<DeliveryJob>(settings.delivery.queueName, {
  connection: kv,
  defaultJobOptions: {
    attempts: settings.delivery.attempts,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { age: 24 * 3600, count: 10_000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

/**
 * Pushes one delayed job per delivery row. The DB id doubles as the BullMQ jobId,
 * so re-adding an id that is already queued is a no-op (enqueue is idempotent).
 */
export async function enqueueDeliveries(items: { id: string; due_at: Date }[]): Promise<void> {
  const CHUNK = 500;
  for (let i = 0; i < items.length; i += CHUNK) {
    const now = Date.now();
    await deliveryQueue.addBulk(
      items.slice(i, i + CHUNK).map((d) => ({
        name: 'send',
        data: { deliveryId: d.id },
        opts: { jobId: d.id, delay: Math.max(0, new Date(d.due_at).getTime() - now) },
      })),
    );
  }
}
