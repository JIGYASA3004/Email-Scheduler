import { useEffect, useRef, useState } from 'react';
import type { DeliveryItem, DeliveryState, FolderName } from '../model';
import { server } from '../net/endpoints';
import { useFetched } from '../hooks/useFetched';
import { Action } from '../kit/Action';
import { Blank, RowsLoading } from '../kit/Blank';
import { Glyph } from '../kit/Glyph';
import { StateTag } from '../kit/StateTag';

const COPY: Record<FolderName, { empty: string; hint: string }> = {
  scheduled: { empty: 'Nothing scheduled', hint: 'Emails you schedule wait here until they go out.' },
  sent: { empty: 'No sent emails yet', hint: 'Delivered and failed emails show up here.' },
};

const FILTERS: Record<FolderName, { label: string; states: DeliveryState[] | null }[]> = {
  scheduled: [
    { label: 'All scheduled', states: null },
    { label: 'Waiting', states: ['scheduled', 'sending'] },
    { label: 'Rate limited', states: ['throttled'] },
  ],
  sent: [
    { label: 'All sent', states: null },
    { label: 'Delivered', states: ['sent'] },
    { label: 'Failed', states: ['failed'] },
  ],
};

/** Starred ids live in this browser only (a personal convenience, not shared data). */
function useStars(): [Set<string>, (id: string) => void] {
  const [stars, setStars] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('outbox.stars') ?? '[]'));
    } catch {
      return new Set();
    }
  });
  const toggle = (id: string) =>
    setStars((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      try {
        localStorage.setItem('outbox.stars', JSON.stringify([...next]));
      } catch {
        /* storage unavailable: stars just won't persist */
      }
      return next;
    });
  return [stars, toggle];
}

interface RowProps {
  item: DeliveryItem;
  starred: boolean;
  onStar: () => void;
  onOpen: () => void;
}

function Row({ item, starred, onStar, onOpen }: RowProps) {
  return (
    <div className="ledger-row d-flex align-items-center gap-3 border-bottom" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div className="recipient small text-truncate">To: {item.recipient}</div>
      <StateTag state={item.state} at={item.dueAt} />
      <div className="flex-grow-1 text-truncate small">
        <span className="fw-medium">{item.subject}</span>
        <span className="text-body-tertiary"> - {item.state === 'failed' && item.error ? item.error : item.snippet}</span>
      </div>
      <button
        className={`star-btn ${starred ? 'on' : ''}`}
        aria-label={starred ? 'Unstar' : 'Star'}
        onClick={(e) => {
          e.stopPropagation();
          onStar();
        }}
      >
        <Glyph name="star" size={15} filled={starred} />
      </button>
    </div>
  );
}

/** Shared list for the Scheduled and Sent folders: search, filter, refresh, auto-poll. */
export function Ledger({ folder, onOpen, onCompose }: { folder: FolderName; onOpen: (id: string) => void; onCompose: () => void }) {
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [filterIdx, setFilterIdx] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [stars, toggleStar] = useStars();

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(typed.trim()), 300);
    return () => window.clearTimeout(t);
  }, [typed]);

  useEffect(() => {
    setTyped('');
    setFilterIdx(0);
  }, [folder]);

  useEffect(() => {
    if (!filterOpen) return;
    const close = (e: MouseEvent) => !filterRef.current?.contains(e.target as Node) && setFilterOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [filterOpen]);

  const { data, error, pending, refresh } = useFetched(() => server.folder(folder, search), [folder, search], 5000);
  const filter = FILTERS[folder][filterIdx];
  const items = data?.items.filter((i) => !filter.states || filter.states.includes(i.state));

  return (
    <section className="flex-grow-1 p-3 overflow-auto">
      <div className="d-flex align-items-center gap-2 mb-2">
        <label className="search-box flex-grow-1 d-flex align-items-center gap-2">
          <Glyph name="search" size={14} className="text-body-tertiary" />
          <input className="border-0 bg-transparent flex-grow-1 small" placeholder="Search" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </label>
        <div className="position-relative" ref={filterRef}>
          <Action tone="plain" icon="filter" aria-label="Filter" title="Filter" className={filter.states ? 'text-primary' : ''} onClick={() => setFilterOpen((o) => !o)} />
          {filterOpen && (
            <div className="dropdown-menu dropdown-menu-end show shadow-sm" style={{ right: 0 }}>
              {FILTERS[folder].map((f, i) => (
                <button key={f.label} className={`dropdown-item small ${i === filterIdx ? 'active' : ''}`} onClick={() => { setFilterIdx(i); setFilterOpen(false); }}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <Action tone="plain" icon="refresh" aria-label="Refresh" title="Refresh" onClick={refresh} />
      </div>

      {pending && !data ? (
        <RowsLoading />
      ) : error && !data ? (
        <Blank icon="close" title="Couldn't load emails" hint={error} action={<Action tone="outline" small onClick={refresh}>Try again</Action>} />
      ) : !items?.length ? (
        search || filter.states ? (
          <Blank icon="search" title="No matches" hint="Nothing here matches your search or filter." />
        ) : (
          <Blank icon={folder === 'sent' ? 'send' : 'clock'} title={COPY[folder].empty} hint={COPY[folder].hint} action={<Action tone="outline" small onClick={onCompose}>Compose an email</Action>} />
        )
      ) : (
        <>
          {items.map((item) => (
            <Row key={item.id} item={item} starred={stars.has(item.id)} onStar={() => toggleStar(item.id)} onOpen={() => onOpen(item.id)} />
          ))}
          {data!.total > data!.items.length && (
            <p className="tiny text-body-secondary text-center mt-3">Showing {data!.items.length} of {data!.total}</p>
          )}
        </>
      )}
    </section>
  );
}
