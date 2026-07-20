import { cn } from '@/lib/cn';
import type { PaymentStatus, ReservationStatus, SessionStatus } from '@/types/enums';
import { PAYMENT_STATUS_LABEL, RESERVATION_STATUS_LABEL } from '@/types/enums';

type Status = ReservationStatus | SessionStatus | PaymentStatus;

const TONE_BY_STATUS: Record<Status, 'neutral' | 'positive' | 'warning' | 'negative'> = {
  PENDING: 'warning',
  CONFIRMED: 'positive',
  ACTIVE: 'positive',
  COMPLETED: 'neutral',
  APPROVED: 'positive',
  EXPIRED: 'negative',
  CANCELLED: 'negative',
  REJECTED: 'negative',
};

const TONE_CLASSES: Record<'neutral' | 'positive' | 'warning' | 'negative', string> = {
  neutral: 'bg-steel-100 text-asphalt',
  positive: 'bg-route-green-100 text-route-green-600',
  warning: 'bg-signal-yellow/15 text-signal-yellow-600',
  negative: 'bg-hazard-red-100 text-hazard-red-600',
};

const LABEL_BY_STATUS: Record<Status, string> = {
  ...RESERVATION_STATUS_LABEL,
  ...PAYMENT_STATUS_LABEL,
  ACTIVE: 'Activa',
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide',
        TONE_CLASSES[TONE_BY_STATUS[status]],
      )}
    >
      {LABEL_BY_STATUS[status]}
    </span>
  );
}
