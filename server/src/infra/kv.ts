import Redis from 'ioredis';
import { settings } from '../settings';

// BullMQ requires maxRetriesPerRequest = null on connections used by workers.
export function openKv(): Redis {
  return new Redis(settings.redisUrl, { maxRetriesPerRequest: null });
}

export const kv = openKv();
