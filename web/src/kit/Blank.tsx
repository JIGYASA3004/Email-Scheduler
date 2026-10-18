import type { ReactNode } from 'react';
import { Glyph, type GlyphName } from './Glyph';

/** Centered placeholder for empty lists and error states. */
export function Blank({ icon, title, hint, action }: { icon: GlyphName; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="text-center text-body-secondary py-5 my-4">
      <div className="blank-badge mx-auto mb-3">
        <Glyph name={icon} size={22} />
      </div>
      <h6 className="text-body mb-1">{title}</h6>
      {hint && <p className="small mb-3">{hint}</p>}
      {action}
    </div>
  );
}

/** Pulsing placeholder rows shown while a list loads. */
export function RowsLoading({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="d-flex gap-3 align-items-center py-3 border-bottom placeholder-glow">
          <span className="placeholder col-2 rounded" />
          <span className="placeholder col-1 rounded-pill" />
          <span className="placeholder col-6 rounded" />
        </div>
      ))}
    </div>
  );
}
