import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { OccupancyChip } from '@/components/ui/OccupancyChip';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency } from '@/lib/format';
import { adminApi } from '@/api/admin.api';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { BranchOccupancy } from '@/types/entities';
import type { OccupancyLevel } from '@/types/enums';

interface OccupancyEvent {
  branchId: string;
  occupied: number;
  total: number;
  level: OccupancyLevel;
}

const RAIL_BY_LEVEL: Record<OccupancyLevel, 'green' | 'yellow' | 'red'> = {
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
};

export function OccupancySection() {
  const [rows, setRows] = useState<BranchOccupancy[] | null>(null);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .occupancyDashboard()
      .then(setRows)
      .catch((error) => notifyError(error));
  }, []);

  useSocketEvent<OccupancyEvent>('branch.occupancy.updated', (payload) => {
    setRows((prev) =>
      prev?.map((row) =>
        row.branch.id === payload.branchId
          ? { ...row, occupiedOrReserved: payload.occupied, totalSlots: payload.total, level: payload.level }
          : row,
      ) ?? prev,
    );
  });

  async function handleSimulateFull(branchId: string) {
    setSimulatingId(branchId);
    try {
      await adminApi.simulateFull(branchId);
      notifySuccess('Sucursal marcada como llena. La ocupación se actualizará en tiempo real.');
    } catch (error) {
      notifyError(error);
    } finally {
      setSimulatingId(null);
    }
  }

  if (!rows) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <Card key={row.branch.id} railColor={RAIL_BY_LEVEL[row.level]} className="flex flex-col gap-3 p-5">
          <div>
            <h3 className="text-base text-asphalt">{row.branch.name}</h3>
            <p className="text-xs text-steel">{row.branch.address}</p>
          </div>
          <div className="flex items-center justify-between">
            <OccupancyChip level={row.level} occupied={row.occupiedOrReserved} total={row.totalSlots} />
            <span className="font-mono text-xs text-steel">{formatCurrency(row.branch.pricePerHour)}/h</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            loading={simulatingId === row.branch.id}
            onClick={() => handleSimulateFull(row.branch.id)}
            className="self-start"
          >
            Simular sucursal llena
          </Button>
        </Card>
      ))}
    </div>
  );
}
