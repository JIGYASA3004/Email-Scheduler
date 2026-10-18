import { useEffect, useState } from 'react';
import type { FolderName } from '../model';

export type Route =
  | { screen: 'folder'; folder: FolderName }
  | { screen: 'compose' }
  | { screen: 'mail'; id: string; from: FolderName };

/** #/scheduled · #/sent · #/compose · #/mail/<id>?from=sent */
function parse(): Route {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  const [head, id] = path.split('/');
  if (head === 'compose') return { screen: 'compose' };
  if (head === 'mail' && id) {
    const from = new URLSearchParams(query).get('from') === 'sent' ? 'sent' : 'scheduled';
    return { screen: 'mail', id, from };
  }
  return { screen: 'folder', folder: head === 'sent' ? 'sent' : 'scheduled' };
}

export const hrefFor = (r: Route): string =>
  r.screen === 'folder' ? `#/${r.folder}` : r.screen === 'compose' ? '#/compose' : `#/mail/${r.id}?from=${r.from}`;

/** Tiny hash router so refresh and the back button keep working. */
export function useHashView(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const sync = () => setRoute(parse());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  return [route, (r) => (window.location.hash = hrefFor(r).slice(1))];
}
