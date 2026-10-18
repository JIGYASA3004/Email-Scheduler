import { Router } from 'express';
import { settings } from '../settings';
import { findAccount } from '../identity/accounts';
import { signedIn, uidOf } from '../identity/google';
import { listMailboxes } from '../delivery/mailboxes';
import { sentThisHour } from '../delivery/throttle';
import { browseFolder, folderTotals, planBatch, type Folder } from './plan';

const ADDRESS = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i;
const MAX_RECIPIENTS = 10_000;

class BadInput extends Error {}

function wholeNumber(value: unknown, field: string, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new BadInput(`${field} must be a whole number between ${min} and ${max}`);
  return n;
}

export const outbox = Router();
outbox.use(signedIn);

outbox.get('/me', async (_req, res) => {
  const me = await findAccount(uidOf(res));
  res.json({ id: me!.id, email: me!.email, name: me!.full_name, picture: me!.picture });
});

outbox.get('/mailboxes', async (_req, res) => {
  const boxes = await listMailboxes();
  const withUsage = await Promise.all(
    boxes.map(async (b) => ({ ...b, sentThisHour: await sentThisHour(b.id) })),
  );
  res.json({ mailboxes: withUsage, maxPerHour: settings.delivery.maxPerHourPerSender, minGapMs: settings.delivery.minGapMs });
});

outbox.post('/batches', async (req, res) => {
  try {
    const b = req.body ?? {};
    const subject = String(b.subject ?? '').trim();
    const body = String(b.body ?? '');
    if (!subject || subject.length > 300) throw new BadInput('Subject is required (max 300 characters)');
    if (!body.trim() || body.length > 50_000) throw new BadInput('Body is required (max 50,000 characters)');

    if (!Array.isArray(b.recipients)) throw new BadInput('recipients must be an array');
    const recipients = [...new Set(b.recipients.map((r: unknown) => String(r).trim().toLowerCase()))] as string[];
    const invalid = recipients.filter((r) => !ADDRESS.test(r));
    if (!recipients.length) throw new BadInput('Add at least one recipient');
    if (invalid.length) throw new BadInput(`Invalid address: ${invalid.slice(0, 3).join(', ')}`);
    if (recipients.length > MAX_RECIPIENTS) throw new BadInput(`At most ${MAX_RECIPIENTS} recipients per batch`);

    const mailboxId = wholeNumber(b.mailboxId, 'mailboxId', 1, 2 ** 31 - 1);
    if (!(await listMailboxes()).some((m) => m.id === mailboxId)) throw new BadInput('Unknown sender');

    const startsAt = b.startsAt ? new Date(b.startsAt) : new Date();
    if (Number.isNaN(startsAt.getTime())) throw new BadInput('startsAt is not a valid date');

    const gapSeconds = wholeNumber(b.gapSeconds ?? 0, 'Delay between emails', 0, 3600);
    const cap = settings.delivery.maxPerHourPerSender;
    const hourlyCap = wholeNumber(b.hourlyCap || cap, 'Hourly limit', 1, cap);

    const key = req.get('Idempotency-Key')?.slice(0, 100) || undefined;
    const result = await planBatch(uidOf(res), {
      mailboxId, subject, body, recipients, startsAt, gapSeconds, hourlyCap, requestKey: key,
    });
    res.status(result.replayed ? 200 : 201).json(result);
  } catch (err) {
    if (err instanceof BadInput) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

outbox.get('/folders/:folder', async (req, res) => {
  const folder = req.params.folder as Folder;
  if (folder !== 'scheduled' && folder !== 'sent') {
    res.status(404).json({ error: 'Unknown folder' });
    return;
  }
  const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 200) : '';
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  res.json(await browseFolder(uidOf(res), { folder, search: search || undefined, limit, offset }));
});

outbox.get('/totals', async (_req, res) => {
  res.json(await folderTotals(uidOf(res)));
});
