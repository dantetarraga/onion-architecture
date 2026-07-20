import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface TicketRow {
  label: string;
  value: string;
}

interface TicketStubProps {
  eyebrow: string;
  code: string;
  qrDataUrl?: string | null;
  rows: TicketRow[];
  footnote?: string;
  accent?: 'yellow' | 'green' | 'red';
  action?: ReactNode;
}

const ACCENT_CLASSES: Record<NonNullable<TicketStubProps['accent']>, string> = {
  yellow: 'text-signal-yellow-600',
  green: 'text-route-green-600',
  red: 'text-hazard-red-600',
};

export function TicketStub({ eyebrow, code, qrDataUrl, rows, footnote, accent = 'yellow', action }: TicketStubProps) {
  return (
    <div className="ticket-stub mx-3 px-6 py-6 shadow-md">
      <div className="flex items-center justify-between gap-3">
        <p className={cn('shrink-0 font-mono text-xs font-semibold uppercase tracking-[0.15em]', ACCENT_CLASSES[accent])}>
          {eyebrow}
        </p>
        <p className="truncate font-mono text-xs text-steel" title={code}>
          {code}
        </p>
      </div>

      {qrDataUrl && (
        <div className="my-5 flex justify-center">
          <img src={qrDataUrl} alt={`Código QR — ${eyebrow.toLowerCase()}`} className="h-44 w-44" />
        </div>
      )}

      <div className="ticket-divider my-4" />

      <dl className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <dt className="shrink-0 font-mono text-[11px] uppercase tracking-wide text-steel">{row.label}</dt>
            <dd className="truncate font-mono text-sm text-asphalt" title={row.value}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      {action && <div className="mt-5">{action}</div>}

      {footnote && <p className="mt-4 text-center font-mono text-[10px] text-steel-300">{footnote}</p>}
    </div>
  );
}
