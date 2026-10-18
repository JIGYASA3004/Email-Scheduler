import { useEffect, useMemo, useState } from 'react';
import { server } from '../net/endpoints';
import { useFetched } from '../hooks/useFetched';
import { Action } from '../kit/Action';
import { Dialog } from '../kit/Dialog';
import { useNotice } from '../kit/Notice';
import { toLocalInput, tomorrowAt } from '../util/clock';
import { LeadDrop } from './LeadDrop';

const QUICK_STARTS: { label: string; at: () => Date }[] = [
  { label: 'In 5 min', at: () => new Date(Date.now() + 5 * 60_000) },
  { label: 'In 1 hour', at: () => new Date(Date.now() + 3_600_000) },
  { label: 'Tomorrow 9 AM', at: () => tomorrowAt(9) },
];

/** Modal form that builds a batch and posts it to the schedule API. */
export function ComposeDialog({ onClose, onScheduled }: { onClose: () => void; onScheduled: () => void }) {
  const notify = useNotice();
  const senders = useFetched(() => server.senders(), []);

  const [mailboxId, setMailboxId] = useState<number>();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [leads, setLeads] = useState<string[]>([]);
  const [startLocal, setStartLocal] = useState(''); // empty = start immediately
  const [gap, setGap] = useState('2');
  const [cap, setCap] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  // one key per dialog: a double-click or network retry can never create two batches
  const requestKey = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    if (mailboxId === undefined && senders.data?.mailboxes[0]) setMailboxId(senders.data.mailboxes[0].id);
  }, [senders.data, mailboxId]);

  const maxPerHour = senders.data?.maxPerHour ?? 200;
  const startsAt = startLocal ? new Date(startLocal) : null;

  const errors = {
    subject: !subject.trim() ? 'Subject is required' : null,
    body: !body.trim() ? 'Body is required' : null,
    leads: !leads.length ? 'Add at least one lead' : null,
    start: startsAt && startsAt.getTime() < Date.now() - 60_000 ? 'Start time is in the past' : null,
    gap: gap !== '' && !(Number(gap) >= 0 && Number(gap) <= 3600) ? '0 – 3600 seconds' : null,
    cap: cap !== '' && !(Number(cap) >= 1 && Number(cap) <= maxPerHour) ? `1 – ${maxPerHour}` : null,
  };
  const invalid = !mailboxId || Object.values(errors).some(Boolean);
  const show = (key: keyof typeof errors) => (touched ? errors[key] : null);

  const submit = async () => {
    setTouched(true);
    if (invalid) return;
    setBusy(true);
    try {
      const receipt = await server.createBatch(
        {
          mailboxId: mailboxId!,
          subject: subject.trim(),
          body,
          recipients: leads,
          startsAt: startsAt?.toISOString() ?? null,
          gapSeconds: gap ? Math.floor(Number(gap)) : 0,
          hourlyCap: cap ? Math.floor(Number(cap)) : null,
        },
        requestKey,
      );
      notify('success', `${receipt.queued} email${receipt.queued === 1 ? '' : 's'} scheduled`);
      onScheduled();
    } catch (err) {
      notify('danger', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const fieldCls = (key: keyof typeof errors) => `form-control ${show(key) ? 'is-invalid' : ''}`;

  return (
    <Dialog
      title="Compose new email"
      subtitle="One message, many leads — paced by your delay and hourly limit."
      onClose={onClose}
      footer={
        <>
          <span className="small text-body-secondary me-auto">
            {leads.length} recipient{leads.length === 1 ? '' : 's'} · starts {startsAt ? startsAt.toLocaleString() : 'now'}
          </span>
          <Action tone="soft" onClick={onClose}>Cancel</Action>
          <Action icon="calendar" busy={busy} onClick={submit}>Schedule</Action>
        </>
      }
    >
      <div className="row g-3">
        <div className="col-12">
          <label className="form-label small fw-semibold">From</label>
          {senders.error ? (
            <div className="small text-danger">{senders.error}</div>
          ) : (
            <select className="form-select" value={mailboxId ?? ''} disabled={senders.pending} onChange={(e) => setMailboxId(Number(e.target.value))}>
              {senders.pending && <option>Loading senders…</option>}
              {senders.data?.mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.address} — {m.sentThisHour}/{maxPerHour} sent this hour
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="col-12">
          <label className="form-label small fw-semibold">Subject</label>
          <input className={fieldCls('subject')} maxLength={300} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Quick question about your team" />
          <div className="invalid-feedback">{show('subject')}</div>
        </div>

        <div className="col-12">
          <label className="form-label small fw-semibold">Body</label>
          <textarea className={fieldCls('body')} rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hi there, …" />
          <div className="invalid-feedback">{show('body')}</div>
        </div>

        <div className="col-12">
          <label className="form-label small fw-semibold">Leads</label>
          <LeadDrop leads={leads} onChange={setLeads} />
          {show('leads') && <div className="tiny text-danger mt-1">{show('leads')}</div>}
        </div>

        <div className="col-md-6">
          <label className="form-label small fw-semibold">Start time</label>
          <input type="datetime-local" className={fieldCls('start')} value={startLocal} min={toLocalInput(new Date())} onChange={(e) => setStartLocal(e.target.value)} />
          <div className="invalid-feedback">{show('start')}</div>
          <div className="d-flex flex-wrap gap-1 mt-2">
            <button className={`btn btn-sm ${startLocal ? 'btn-light border' : 'btn-primary'}`} onClick={() => setStartLocal('')}>Now</button>
            {QUICK_STARTS.map((q) => (
              <button key={q.label} className="btn btn-sm btn-light border" onClick={() => setStartLocal(toLocalInput(q.at()))}>
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div className="col-6 col-md-3">
          <label className="form-label small fw-semibold">Delay between emails</label>
          <div className="input-group">
            <input type="number" min={0} max={3600} className={fieldCls('gap')} value={gap} onChange={(e) => setGap(e.target.value)} />
            <span className="input-group-text">sec</span>
            <div className="invalid-feedback">{show('gap')}</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <label className="form-label small fw-semibold">Hourly limit</label>
          <input type="number" min={1} max={maxPerHour} className={fieldCls('cap')} value={cap} placeholder={`${maxPerHour}`} onChange={(e) => setCap(e.target.value)} />
          <div className="invalid-feedback">{show('cap')}</div>
          <div className="form-text tiny">Server max {maxPerHour}/h per sender</div>
        </div>
      </div>
    </Dialog>
  );
}
