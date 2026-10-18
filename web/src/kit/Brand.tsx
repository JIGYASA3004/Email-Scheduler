import { Glyph } from './Glyph';

/** App wordmark: a small badge plus the product name. */
export function Brand() {
  return (
    <span className="brand d-inline-flex align-items-center gap-2">
      <span className="brand-badge"><Glyph name="send" size={15} /></span>
      <span className="brand-name">Outbox</span>
    </span>
  );
}
