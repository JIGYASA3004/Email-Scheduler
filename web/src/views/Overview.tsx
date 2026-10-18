import { useEffect, useState } from 'react';
import type { FolderName, FolderTotals } from '../model';
import { server } from '../net/endpoints';
import { useFetched } from '../hooks/useFetched';
import { Action } from '../kit/Action';
import { Blank } from '../kit/Blank';
import { Glyph, type GlyphName } from '../kit/Glyph';
import { DeliveryTable } from './DeliveryTable';

const TABS: { key: FolderName; label: string; icon: GlyphName; empty: string; hint: string }[] = [
  { key: 'scheduled', label: 'Scheduled', icon: 'clock', empty: 'No scheduled emails', hint: 'Emails waiting to go out will appear here.' },
  { key: 'sent', label: 'Sent', icon: 'send', empty: 'No sent emails yet', hint: 'Delivered and failed emails will appear here.' },
];

function StatCard({ label, value, icon, tint }: { label: string; value: number | undefined; icon: GlyphName; tint: string }) {
  return (
    <div className="col-6 col-md-3">
      <div className="card border-0 shadow-sm h-100">
        <div className="card-body d-flex align-items-center gap-3">
          <span className={`stat-icon ${tint}`}><Glyph name={icon} size={18} /></span>
          <div>
            <div className="tiny text-uppercase text-body-secondary fw-semibold">{label}</div>
            <div className="fs-4 fw-bold lh-1 mt-1">{value ?? '–'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface OverviewProps {
  tab: FolderName;
  setTab: (t: FolderName) => void;
  totals: FolderTotals | undefined;
  onCompose: () => void;
  reloadToken: number;
}

/** Dashboard body: stat cards, Scheduled/Sent tabs with search, and the delivery table. */
export function Overview({ tab, setTab, totals, onCompose, reloadToken }: OverviewProps) {
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(typed.trim()), 300);
    return () => window.clearTimeout(t);
  }, [typed]);

  const list = useFetched(() => server.folder(tab, search), [tab, search, reloadToken], 5000);
  const senders = useFetched(() => server.senders(), [reloadToken], 15000);
  const usedThisHour = senders.data?.mailboxes.reduce((sum, m) => sum + m.sentThisHour, 0);
  const meta = TABS.find((t) => t.key === tab)!;

  return (
    <main className="container-xl py-4 px-3 px-md-4">
      <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
        <div className="me-auto">
          <h1 className="h4 fw-bold mb-0">Email campaigns</h1>
          <div className="small text-body-secondary">Schedule, pace and track every outgoing message.</div>
        </div>
        <Action icon="send" onClick={onCompose}>Compose New Email</Action>
      </div>

      <div className="row g-3 mb-4">
        <StatCard label="Scheduled" value={totals?.scheduled} icon="clock" tint="tint-indigo" />
        <StatCard label="Sent" value={totals?.sent} icon="send" tint="tint-green" />
        <StatCard label="Sent this hour" value={usedThisHour} icon="refresh" tint="tint-amber" />
        <StatCard label="Senders" value={senders.data?.mailboxes.length} icon="board" tint="tint-sky" />
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-body d-flex flex-wrap align-items-center gap-2 py-2">
          <ul className="nav nav-pills me-auto">
            {TABS.map((t) => (
              <li className="nav-item" key={t.key}>
                <button
                  className={`nav-link d-flex align-items-center gap-2 ${tab === t.key ? 'active' : ''}`}
                  onClick={() => {
                    setTyped('');
                    setTab(t.key);
                  }}
                >
                  <Glyph name={t.icon} size={14} /> {t.label}
                  <span className={`badge rounded-pill ${tab === t.key ? 'bg-white text-primary' : 'text-bg-light'}`}>{totals?.[t.key] ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="input-group input-group-sm search-group">
            <span className="input-group-text bg-body"><Glyph name="search" size={14} /></span>
            <input className="form-control" placeholder="Search email or subject" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
          <Action tone="soft" small icon="refresh" title="Refresh" aria-label="Refresh" onClick={list.refresh} />
        </div>

        {list.error && !list.data ? (
          <Blank icon="close" title="Couldn't load emails" hint={list.error} action={<Action tone="outline" small onClick={list.refresh}>Try again</Action>} />
        ) : !list.pending && !list.data?.items.length ? (
          search ? (
            <Blank icon="search" title="No matches" hint={`Nothing in ${meta.label} matches “${search}”.`} />
          ) : (
            <Blank icon={meta.icon} title={meta.empty} hint={meta.hint} action={<Action tone="outline" small onClick={onCompose}>Compose an email</Action>} />
          )
        ) : (
          <DeliveryTable folder={tab} items={list.data?.items} loading={list.pending} />
        )}

        {list.data && list.data.total > list.data.items.length && (
          <div className="card-footer bg-body tiny text-body-secondary text-center">
            Showing {list.data.items.length} of {list.data.total}
          </div>
        )}
      </div>
    </main>
  );
}
