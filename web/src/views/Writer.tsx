import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { server } from '../net/endpoints';
import { useFetched } from '../hooks/useFetched';
import { Action } from '../kit/Action';
import { Glyph } from '../kit/Glyph';
import { useNotice } from '../kit/Notice';
import { longStamp } from '../util/clock';
import { LaterMenu } from './LaterMenu';
import { LeadChips } from './LeadChips';

const Line = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="d-flex align-items-center gap-3 py-2 border-bottom writer-line">
    <span className="small writer-label">{label}</span>
    {children}
  </div>
);

/** Compose page: sender, leads, subject, pacing (delay + hourly limit), body, optional start time. */
export function Writer({ onClose, onScheduled }: { onClose: () => void; onScheduled: () => void }) {
  const notify = useNotice();
  const senders = useFetched(() => server.senders(), []);

  const [mailboxId, setMailboxId] = useState<number>();
  const [leads, setLeads] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [gap, setGap] = useState('');
  const [cap, setCap] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // one key per compose session: a double-click or retry can never create two batches
  const requestKey = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    if (mailboxId === undefined && senders.data?.mailboxes[0]) setMailboxId(senders.data.mailboxes[0].id);
  }, [senders.data, mailboxId]);

  const maxPerHour = senders.data?.maxPerHour ?? 200;

  const problem = (): string | null => {
    if (!mailboxId) return 'No sender available yet';
    if (!leads.length) return 'Add at least one recipient';
    if (!subject.trim()) return 'Subject is required';
    if (!body.trim()) return 'Write a message';
    if (gap && !(Number(gap) >= 0 && Number(gap) <= 3600)) return 'Delay must be 0–3600 seconds';
    if (cap && !(Number(cap) >= 1 && Number(cap) <= maxPerHour)) return `Hourly limit must be 1–${maxPerHour}`;
    if (startsAt && startsAt.getTime() < Date.now() - 60_000) return 'The send-later time has passed';
    return null;
  };

  const submit = async () => {
    const issue = problem();
    if (issue) return notify('danger', issue);
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

  return (
    <section className="flex-grow-1 overflow-auto bg-white">
      <header className="d-flex align-items-center gap-3 px-4 py-3 position-relative">
        <Action tone="plain" icon="back" aria-label="Back" onClick={onClose} />
        <h1 className="h5 m-0 flex-grow-1">Compose New Email</h1>
        <Action
          tone="plain"
          icon="clock"
          aria-label="Send later"
          title="Send later"
          className={startsAt ? 'text-primary' : ''}
          onClick={() => setPickerOpen((o) => !o)}
        />
        <Action tone="outline" small busy={busy} onClick={submit} className="px-3">
          {startsAt ? 'Send Later' : 'Send'}
        </Action>
        {pickerOpen && (
          <LaterMenu
            current={startsAt}
            onCancel={() => setPickerOpen(false)}
            onDone={(when) => {
              setStartsAt(when);
              setPickerOpen(false);
            }}
          />
        )}
      </header>

      <div className="writer-body mx-auto px-3 pb-5">
        {startsAt && (
          <div className="later-note small d-flex align-items-center gap-2 mb-2">
            <Glyph name="calendar" size={14} /> Sending starts {longStamp(startsAt.toISOString())}
          </div>
        )}

        <Line label="From">
          {senders.pending ? (
            <span className="spinner-border spinner-border-sm text-body-secondary" />
          ) : senders.error ? (
            <span className="small text-danger">{senders.error}</span>
          ) : (
            <select className="form-select form-select-sm from-select" value={mailboxId ?? ''} onChange={(e) => setMailboxId(Number(e.target.value))}>
              {senders.data?.mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.address}
                </option>
              ))}
            </select>
          )}
        </Line>

        <Line label="To">
          <LeadChips leads={leads} onChange={setLeads} />
        </Line>

        <Line label="Subject">
          <input className="bare-input flex-grow-1 small" placeholder="Subject" value={subject} maxLength={300} onChange={(e) => setSubject(e.target.value)} />
        </Line>

        <div className="d-flex flex-wrap align-items-center gap-4 py-3">
          <label className="d-flex align-items-center gap-2 small">
            Delay between 2 emails
            <input className="form-control form-control-sm pace-input" type="number" min={0} max={3600} placeholder="00" title="Seconds" value={gap} onChange={(e) => setGap(e.target.value)} />
          </label>
          <label className="d-flex align-items-center gap-2 small">
            Hourly Limit
            <input className="form-control form-control-sm pace-input" type="number" min={1} max={maxPerHour} placeholder="00" title={`Max ${maxPerHour}`} value={cap} onChange={(e) => setCap(e.target.value)} />
          </label>
        </div>

        <textarea className="form-control body-area small" placeholder="Type Your Reply..." value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
    </section>
  );
}
