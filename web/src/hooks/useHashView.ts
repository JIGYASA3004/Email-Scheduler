import { useEffect, useState } from 'react';
import type { FolderName } from '../model';

const fromHash = (): FolderName => (window.location.hash.replace(/^#\/?/, '') === 'sent' ? 'sent' : 'scheduled');

/** Keeps the active tab in the URL hash (#/scheduled, #/sent) so refresh & back work. */
export function useHashView(): [FolderName, (v: FolderName) => void] {
  const [view, setView] = useState<FolderName>(fromHash);
  useEffect(() => {
    const sync = () => setView(fromHash());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  return [view, (v) => (window.location.hash = `/${v}`)];
}
