import { kv } from '../infra/kv';

export const HOUR_MS = 3_600_000;

/*
 * Atomic send-slot reservation for one sender, safe across any number of workers/hosts.
 *
 * Two hourly counters are checked (both keyed by clock-hour window):
 *   - the sender counter  -> MAX_EMAILS_PER_HOUR_PER_SENDER
 *   - the batch counter   -> the "Hourly limit" the user picked for that batch
 * plus a per-sender "next free time" pointer that enforces the minimum gap between sends.
 *
 * Granted:  both counters are bumped, the pointer moves to slot + gap.
 * Deferred: nothing is consumed. The caller gets a wake-up time in the next hour window,
 *           staggered by its position in that window's overflow line so FIFO order survives.
 *
 * KEYS[1] gap pointer   KEYS[2] sender counter prefix   KEYS[3] batch counter prefix   KEYS[4] overflow prefix
 * ARGV    now, gap, senderCap, batchCap, hourMs
 * returns {1, slot} granted  |  {0, wakeAt} deferred
 */
const RESERVE = `
local now, gap = tonumber(ARGV[1]), tonumber(ARGV[2])
local senderCap, batchCap, hour = tonumber(ARGV[3]), tonumber(ARGV[4]), tonumber(ARGV[5])

local slot = math.max(now, tonumber(redis.call('GET', KEYS[1]) or '0'))
local w = math.floor(slot / hour)
local senderKey, batchKey = KEYS[2] .. w, KEYS[3] .. w

local senderUsed = tonumber(redis.call('GET', senderKey) or '0')
local batchUsed = tonumber(redis.call('GET', batchKey) or '0')
if senderUsed >= senderCap or batchUsed >= batchCap then
  local lineKey = KEYS[4] .. (w + 1)
  local position = redis.call('INCR', lineKey)
  redis.call('PEXPIRE', lineKey, hour * 3)
  return { 0, (w + 1) * hour + (position - 1) * gap }
end

redis.call('INCR', senderKey)
redis.call('PEXPIRE', senderKey, hour * 3)
redis.call('INCR', batchKey)
redis.call('PEXPIRE', batchKey, hour * 3)
redis.call('SET', KEYS[1], slot + gap, 'PX', hour * 3)
return { 1, slot }
`;

export type Reservation = { granted: true; slot: number } | { granted: false; wakeAt: number };

export async function reserveSlot(opts: {
  mailboxId: number;
  batchId: string;
  gapMs: number;
  senderCap: number;
  batchCap: number;
}): Promise<Reservation> {
  const tag = `throttle:{mbx:${opts.mailboxId}}`; // hash tag keeps all keys on one cluster slot
  const [granted, at] = (await kv.eval(
    RESERVE,
    4,
    `${tag}:next`,
    `${tag}:hour:`,
    `${tag}:batch:${opts.batchId}:hour:`,
    `${tag}:overflow:`,
    Date.now(),
    opts.gapMs,
    Math.max(1, opts.senderCap),
    Math.max(1, opts.batchCap),
    HOUR_MS,
  )) as [number, number];
  return granted === 1 ? { granted: true, slot: at } : { granted: false, wakeAt: at };
}

/** Sends counted so far in the current hour for a sender (shown in the compose sender picker). */
export async function sentThisHour(mailboxId: number): Promise<number> {
  const window = Math.floor(Date.now() / HOUR_MS);
  return Number((await kv.get(`throttle:{mbx:${mailboxId}}:hour:${window}`)) ?? 0);
}
