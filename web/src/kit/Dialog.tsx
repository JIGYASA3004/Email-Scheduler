import { useEffect, type ReactNode } from 'react';

interface DialogProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}

/** Bootstrap modal markup driven by React state (no Bootstrap JS needed). */
export function Dialog({ title, subtitle, onClose, footer, children }: DialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.body.classList.add('modal-open');
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <>
      <div className="modal d-block" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal-dialog modal-lg modal-dialog-scrollable modal-fullscreen-md-down">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header">
              <div>
                <h5 className="modal-title fw-semibold">{title}</h5>
                {subtitle && <div className="small text-body-secondary">{subtitle}</div>}
              </div>
              <button className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">{children}</div>
            <div className="modal-footer">{footer}</div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
