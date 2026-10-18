import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Kind = 'success' | 'danger' | 'info';
interface Note {
  id: number;
  kind: Kind;
  text: string;
}

const NoticeContext = createContext<(kind: Kind, text: string) => void>(() => undefined);

/** Bootstrap toasts in the corner; call `useNotice()(kind, text)` from anywhere. */
export function NoticeHost({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const dismiss = (id: number) => setNotes((all) => all.filter((n) => n.id !== id));

  const push = useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random();
    setNotes((all) => [...all.slice(-3), { id, kind, text }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, []);

  return (
    <NoticeContext.Provider value={push}>
      {children}
      <div className="toast-container position-fixed bottom-0 end-0 p-3">
        {notes.map((n) => (
          <div key={n.id} className={`toast show align-items-center text-bg-${n.kind} border-0`} role="status">
            <div className="d-flex">
              <div className="toast-body">{n.text}</div>
              <button className="btn-close btn-close-white me-2 m-auto" aria-label="Dismiss" onClick={() => dismiss(n.id)} />
            </div>
          </div>
        ))}
      </div>
    </NoticeContext.Provider>
  );
}

export const useNotice = () => useContext(NoticeContext);
