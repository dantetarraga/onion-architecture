import type { OccupancyLevel } from '@/types/enums';
import { cn } from '@/lib/cn';

interface OccupancyChipProps {
  level: OccupancyLevel;
  occupied: number;
  total: number;
}

const LEVEL_META: Record<OccupancyLevel, { label: string; dot: string; text: string; bg: string }> = {
  GREEN: { label: 'Disponible', dot: 'bg-route-green', text: 'text-route-green-600', bg: 'bg-route-green-100' },
  YELLOW: { label: 'Ocupación media', dot: 'bg-signal-yellow-600', text: 'text-signal-yellow-600', bg: 'bg-signal-yellow/15' },
  RED: { label: 'Casi lleno', dot: 'bg-hazard-red', text: 'text-hazard-red-600', bg: 'bg-hazard-red-100' },
};

export function OccupancyChip({ level, occupied, total }: OccupancyChipProps) {
  const meta = LEVEL_META[level];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs font-medium',
        meta.text,
        meta.bg,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden />
      {meta.label} · {occupied}/{total}
    </span>
  );
}
