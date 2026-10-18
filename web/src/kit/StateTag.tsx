import type { DeliveryState } from '../model';
import { stamp } from '../util/clock';
import { Glyph } from './Glyph';

const LOOK: Record<DeliveryState, { cls: string; label: string }> = {
  scheduled: { cls: 'tag-due', label: '' },
  sending: { cls: 'tag-due', label: 'Sending · ' },
  throttled: { cls: 'tag-hold', label: 'Rate limited · ' },
  sent: { cls: 'tag-done', label: 'Sent' },
  failed: { cls: 'tag-fail', label: 'Failed' },
};

/** Row pill: pending emails show their due time, finished ones their outcome. */
export function StateTag({ state, at }: { state: DeliveryState; at: string }) {
  const look = LOOK[state];
  const finished = state === 'sent' || state === 'failed';
  return (
    <span className={`state-tag ${look.cls}`}>
      {!finished && <Glyph name="clock" size={12} />}
      {look.label}
      {!finished && stamp(at)}
    </span>
  );
}
