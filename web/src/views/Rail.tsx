import { useEffect, useRef, useState } from 'react';
import type { FolderName, FolderTotals, Profile } from '../model';
import { Action } from '../kit/Action';
import { Brand } from '../kit/Brand';
import { Glyph, type GlyphName } from '../kit/Glyph';
import { Portrait } from '../kit/Portrait';

interface RailProps {
  me: Profile;
  active: FolderName | null;
  totals: FolderTotals | undefined;
  openFolder: (f: FolderName) => void;
  onCompose: () => void;
  onSignOut: () => void;
}

const FOLDERS: { key: FolderName; label: string; icon: GlyphName }[] = [
  { key: 'scheduled', label: 'Scheduled', icon: 'clock' },
  { key: 'sent', label: 'Sent', icon: 'send' },
];

/** Left navigation: brand, account card with logout, compose, folders with counts. */
export function Rail({ me, active, totals, openFolder, onCompose, onSignOut }: RailProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <aside className="rail d-flex flex-column gap-3 p-3">
      <Brand />

      <div className="position-relative" ref={menuRef}>
        <button className="account-chip w-100 d-flex align-items-center gap-2 text-start" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen}>
          <Portrait src={me.picture} name={me.name} />
          <span className="flex-grow-1 overflow-hidden">
            <span className="d-block fw-medium small text-truncate">{me.name}</span>
            <span className="d-block tiny text-body-secondary text-truncate">{me.email}</span>
          </span>
          <Glyph name="chevron" size={14} className="text-body-secondary" />
        </button>
        {menuOpen && (
          <div className="dropdown-menu show w-100 mt-1 shadow-sm">
            <button className="dropdown-item d-flex align-items-center gap-2 text-danger small" onClick={onSignOut}>
              <Glyph name="logout" size={14} /> Logout
            </button>
          </div>
        )}
      </div>

      <Action tone="outline" className="w-100" onClick={onCompose}>
        Compose
      </Action>

      <nav>
        <div className="tiny text-uppercase text-body-tertiary mb-2 px-2">Core</div>
        {FOLDERS.map((f) => (
          <button key={f.key} className={`folder-link w-100 d-flex align-items-center gap-2 ${active === f.key ? 'active' : ''}`} onClick={() => openFolder(f.key)}>
            <Glyph name={f.icon} />
            <span className="flex-grow-1 text-start">{f.label}</span>
            <span className="tiny text-body-secondary">{totals?.[f.key] ?? ''}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
