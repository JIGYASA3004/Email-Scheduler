import { useEffect, useRef, useState } from 'react';
import type { Profile } from '../model';
import { Glyph } from '../kit/Glyph';
import { Portrait } from '../kit/Portrait';

/** Top navbar: brand and the signed-in user with a logout menu. */
export function TopBar({ me, onSignOut }: { me: Profile; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !holder.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <nav className="navbar navbar-expand bg-body border-bottom sticky-top px-3 px-md-4">
      <span className="navbar-brand d-flex align-items-center gap-2 fw-semibold">
        <span className="brand-badge"><Glyph name="send" size={16} /></span>
        Outbox
      </span>

      <div className="ms-auto d-flex align-items-center gap-3">
        <div className="dropdown" ref={holder}>
          <button className="btn d-flex align-items-center gap-2 p-1 border-0" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <Portrait src={me.picture} name={me.name} size={36} />
            <span className="text-start d-none d-md-block lh-sm">
              <span className="d-block fw-semibold small">{me.name}</span>
              <span className="d-block tiny text-body-secondary">{me.email}</span>
            </span>
            <Glyph name="chevron" size={14} className="text-body-secondary" />
          </button>
          {open && (
            <ul className="dropdown-menu dropdown-menu-end show shadow-sm mt-1" style={{ right: 0 }}>
              <li className="px-3 py-2 d-md-none">
                <div className="fw-semibold small">{me.name}</div>
                <div className="tiny text-body-secondary">{me.email}</div>
              </li>
              <li>
                <button className="dropdown-item d-flex align-items-center gap-2 text-danger" onClick={onSignOut}>
                  <Glyph name="logout" size={14} /> Log out
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>
    </nav>
  );
}
