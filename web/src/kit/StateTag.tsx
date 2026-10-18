import type { DeliveryState } from '../model';

const LOOK: Record<DeliveryState, { cls: string; label: string }> = {
  scheduled: { cls: 'bg-primary-subtle text-primary-emphasis', label: 'Scheduled' },
  throttled: { cls: 'bg-warning-subtle text-warning-emphasis', label: 'Rate limited' },
  sending: { cls: 'bg-info-subtle text-info-emphasis', label: 'Sending' },
  sent: { cls: 'bg-success-subtle text-success-emphasis', label: 'Sent' },
  failed: { cls: 'bg-danger-subtle text-danger-emphasis', label: 'Failed' },
};

/** Coloured status badge with a leading dot. */
export function StateTag({ state }: { state: DeliveryState }) {
  const look = LOOK[state];
  return (
    <span className={`badge rounded-pill fw-medium state-dot ${look.cls}`}>
      <i />
      {look.label}
    </span>
  );
}
