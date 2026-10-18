import { useState } from 'react';
import { Action } from '../kit/Action';
import { toLocalInput, tomorrowAt } from '../util/clock';

const PRESETS: { label: string; at: () => Date }[] = [
  { label: 'Tomorrow', at: () => tomorrowAt(9) },
  { label: 'Tomorrow, 10:00 AM', at: () => tomorrowAt(10) },
  { label: 'Tomorrow, 11:00 AM', at: () => tomorrowAt(11) },
  { label: 'Tomorrow, 3:00 PM', at: () => tomorrowAt(15) },
];

interface LaterMenuProps {
  current: Date | null;
  onDone: (when: Date | null) => void;
  onCancel: () => void;
}

/** "Send Later" popover: a date-time picker plus quick presets. */
export function LaterMenu({ current, onDone, onCancel }: LaterMenuProps) {
  const [value, setValue] = useState(current ? toLocalInput(current) : '');
  const picked = value ? new Date(value) : null;
  const inPast = picked !== null && picked.getTime() < Date.now() - 60_000;

  return (
    <div className="later-menu card shadow-sm p-3">
      <h6 className="fw-semibold small mb-3">Send Later</h6>
      <input
        type="datetime-local"
        className="form-control form-control-sm border-0 border-bottom rounded-0 px-0 mb-2"
        value={value}
        min={toLocalInput(new Date())}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Pick date & time"
      />
      {inPast && <div className="tiny text-danger mb-2">That time has already passed.</div>}
      <div className="d-flex flex-column mb-3">
        {PRESETS.map((p) => (
          <button key={p.label} className={`preset text-start ${value === toLocalInput(p.at()) ? 'picked' : ''}`} onClick={() => setValue(toLocalInput(p.at()))}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="d-flex justify-content-end align-items-center gap-2">
        {current && (
          <button className="btn btn-link btn-sm text-body-secondary me-auto px-0" onClick={() => onDone(null)}>
            Send now
          </button>
        )}
        <button className="btn btn-link btn-sm text-body text-decoration-none" onClick={onCancel}>
          Cancel
        </button>
        <Action tone="outline" small disabled={!picked || inPast} onClick={() => onDone(picked)} className="px-3">
          Done
        </Action>
      </div>
    </div>
  );
}
