import { useRef, useState, type KeyboardEvent } from 'react';
import { harvestAddresses, looksLikeAddress } from '../util/addresses';
import { useNotice } from '../kit/Notice';
import { Glyph } from '../kit/Glyph';

const VISIBLE = 3;

interface LeadChipsProps {
  leads: string[];
  onChange: (next: string[]) => void;
}

/** "To" row: typed addresses become chips; a CSV / TXT upload adds every address found in it. */
export function LeadChips({ leads, onChange }: LeadChipsProps) {
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const notify = useNotice();

  const merge = (extra: string[]) => onChange([...new Set([...leads, ...extra])]);

  const commitDraft = () => {
    const found = harvestAddresses(draft);
    if (found.length) merge(found);
    else if (draft.trim() && !looksLikeAddress(draft)) notify('danger', `“${draft.trim()}” is not a valid email`);
    setDraft('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', ' ', 'Tab'].includes(e.key) && draft.trim()) {
      e.preventDefault();
      commitDraft();
    } else if (e.key === 'Backspace' && !draft && leads.length) {
      onChange(leads.slice(0, -1));
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const found = harvestAddresses(await file.text());
    if (!found.length) notify('danger', `No email addresses found in ${file.name}`);
    else {
      merge(found);
      notify('success', `${found.length} email address${found.length === 1 ? '' : 'es'} detected in ${file.name}`);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const shown = expanded ? leads : leads.slice(0, VISIBLE);

  return (
    <div className="d-flex align-items-center gap-2 flex-grow-1">
      <div className="d-flex flex-wrap align-items-center gap-1 flex-grow-1">
        {shown.map((lead) => (
          <span key={lead} className="lead-chip">
            {lead}
            <button aria-label={`Remove ${lead}`} onClick={() => onChange(leads.filter((l) => l !== lead))}>
              <Glyph name="close" size={10} />
            </button>
          </span>
        ))}
        {leads.length > VISIBLE && (
          <button className="lead-chip more" onClick={() => setExpanded((x) => !x)}>
            {expanded ? 'less' : `+${leads.length - VISIBLE}`}
          </button>
        )}
        <input
          className="bare-input flex-grow-1 small"
          style={{ minWidth: 160 }}
          placeholder={leads.length ? '' : 'recipient@example.com'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={commitDraft}
          onPaste={(e) => {
            const found = harvestAddresses(e.clipboardData.getData('text'));
            if (found.length > 1) {
              e.preventDefault();
              merge(found);
            }
          }}
        />
      </div>
      <div className="text-end flex-shrink-0">
        <button className="btn btn-link btn-sm text-primary text-decoration-none d-inline-flex align-items-center gap-1 p-0" onClick={() => fileRef.current?.click()}>
          <Glyph name="upload" size={14} /> Upload List
        </button>
        {leads.length > 0 && <div className="tiny text-body-secondary">{leads.length} email{leads.length === 1 ? '' : 's'} detected</div>}
        <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
    </div>
  );
}
