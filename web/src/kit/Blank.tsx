import type { ReactNode } from 'react';
import { Glyph, type GlyphName } from './Glyph';

/** Centered placeholder for empty lists and error states. */
export function Blank({ icon, title, hint, action }: { icon: GlyphName; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="text-center text-body-secondary py-5">
      <div className="blank-badge mx-auto mb-3">
        <Glyph name={icon} size={24} />
      </div>
      <h6 className="text-body fw-semibold mb-1">{title}</h6>
      {hint && <p className="small mb-3">{hint}</p>}
      {action}
    </div>
  );
}

/** Placeholder table rows shown while data loads. */
export function RowsLoading({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <tbody aria-busy="true" className="placeholder-glow">
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <td key={c}>
              <span className={`placeholder rounded col-${[8, 10, 6, 4][c % 4]}`} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
