import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Glyph, type GlyphName } from './Glyph';

type Tone = 'solid' | 'outline' | 'soft' | 'plain';

const TONE: Record<Tone, string> = {
  solid: 'btn btn-primary',
  outline: 'btn btn-outline-primary rounded-pill',
  soft: 'btn btn-soft',
  plain: 'btn btn-link text-body-secondary p-1',
};

interface ActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  icon?: GlyphName;
  busy?: boolean;
  small?: boolean;
  children?: ReactNode;
}

/** The single button primitive used everywhere in the app. */
export function Action({ tone = 'solid', icon, busy, small, children, className = '', disabled, ...rest }: ActionProps) {
  return (
    <button
      type="button"
      className={`${TONE[tone]} ${small ? 'btn-sm' : ''} d-inline-flex align-items-center justify-content-center gap-2 ${className}`}
      disabled={disabled || busy}
      {...rest}
    >
      {busy ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : icon && <Glyph name={icon} />}
      {children}
    </button>
  );
}
