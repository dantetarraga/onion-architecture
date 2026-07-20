import { Card } from '@/components/ui/Card';
import { OccupancyChip } from '@/components/ui/OccupancyChip';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/format';
import type { Branch } from '@/types/entities';
import type { OccupancyLevel } from '@/types/enums';

interface BranchCardProps {
  branch: Branch;
  occupancy?: { occupied: number; total: number; level: OccupancyLevel };
  onReserve: () => void;
}

const RAIL_BY_LEVEL: Record<OccupancyLevel, 'green' | 'yellow' | 'red'> = {
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
};

export function BranchCard({ branch, occupancy, onReserve }: BranchCardProps) {
  return (
    <Card railColor={occupancy ? RAIL_BY_LEVEL[occupancy.level] : 'none'} className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg text-asphalt">{branch.name}</h3>
          <p className="mt-0.5 text-sm text-steel">{branch.address}</p>
        </div>
        <span className="whitespace-nowrap rounded-sm bg-asphalt px-2 py-1 font-mono text-xs text-paper">
          {formatCurrency(branch.pricePerHour)}/h
        </span>
      </div>

      {occupancy ? (
        <OccupancyChip level={occupancy.level} occupied={occupancy.occupied} total={occupancy.total} />
      ) : (
        <div className="h-6 w-32 animate-pulse rounded-full bg-concrete-200" />
      )}

      <Button onClick={onReserve} size="sm" className="mt-auto self-start">
        Reservar
      </Button>
    </Card>
  );
}
