import { useRef, useState, type DragEvent } from 'react';
import { harvestAddresses } from '../util/addresses';
import { Glyph } from '../kit/Glyph';

interface LeadDropProps {
  leads: string[];
  onChange: (next: string[]) => void;
}

/** Drag-and-drop / browse zone for a CSV or TXT lead list, plus a manual paste box. */
export function LeadDrop({ leads, onChange }: LeadDropProps) {
  const picker = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const ingest = async (file: File | undefined) => {
    if (!file) return;
    const found = harvestAddresses(await file.text());
    setFileName(file.name);
    setProblem(found.length ? null : `No email addresses found in ${file.name}`);
    onChange([...new Set([...harvestAddresses(pasted), ...found])]);
    if (picker.current) picker.current.value = '';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void ingest(e.dataTransfer.files[0]);
  };

  const onPaste = (text: string) => {
    setPasted(text);
    onChange(harvestAddresses(text));
    setFileName(null);
    setProblem(null);
  };

  return (
    <div>
      <div
        className={`lead-drop rounded-3 p-4 text-center ${over ? 'is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        onClick={() => picker.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && picker.current?.click()}
      >
        <Glyph name="upload" size={22} className="text-primary mb-2" />
        <div className="small">
          <span className="fw-semibold text-primary">Upload a CSV / TXT</span> or drag it here
        </div>
        {fileName && <div className="tiny text-body-secondary mt-1">{fileName}</div>}
        <input ref={picker} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={(e) => ingest(e.target.files?.[0])} />
      </div>

      <textarea
        className="form-control form-control-sm mt-2"
        rows={2}
        placeholder="…or paste addresses separated by commas, spaces or new lines"
        value={pasted}
        onChange={(e) => onPaste(e.target.value)}
      />

      <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
        <span className={`badge ${leads.length ? 'text-bg-primary' : 'text-bg-secondary'}`}>
          {leads.length} email{leads.length === 1 ? '' : 's'} detected
        </span>
        {leads.slice(0, 4).map((l) => (
          <span key={l} className="badge text-bg-light border fw-normal">{l}</span>
        ))}
        {leads.length > 4 && <span className="tiny text-body-secondary">+{leads.length - 4} more</span>}
        {leads.length > 0 && (
          <button className="btn btn-link btn-sm p-0 ms-auto tiny" onClick={() => { onChange([]); setPasted(''); setFileName(null); }}>
            Clear
          </button>
        )}
      </div>
      {problem && <div className="tiny text-danger mt-1">{problem}</div>}
    </div>
  );
}
