import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { branchesApi } from '@/api/branches.api';
import { useBranchRooms } from '@/hooks/useBranchRooms';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { notifyError } from '@/lib/notify';
import type { Branch } from '@/types/entities';
import type { OccupancyLevel } from '@/types/enums';
import { BranchCard } from './BranchCard';
import { ReservationModal } from './ReservationModal';

interface OccupancyEvent {
  branchId: string;
  occupied: number;
  total: number;
  level: OccupancyLevel;
}

export function BranchesPage() {
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [occupancyByBranch, setOccupancyByBranch] = useState<Record<string, OccupancyEvent>>({});
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  const branchIds = useMemo(() => branches?.map((branch) => branch.id) ?? [], [branches]);
  useBranchRooms(branchIds);

  useEffect(() => {
    branchesApi
      .list()
      .then(async (list) => {
        setBranches(list);
        const occupancy = await branchesApi.occupancy(list.map((branch) => branch.id));
        setOccupancyByBranch(
          Object.fromEntries(
            occupancy.map((row) => [
              row.branch.id,
              { branchId: row.branch.id, occupied: row.occupiedOrReserved, total: row.totalSlots, level: row.level },
            ]),
          ),
        );
      })
      .catch((error) => notifyError(error));
  }, []);

  useSocketEvent<OccupancyEvent>('branch.occupancy.updated', (payload) => {
    setOccupancyByBranch((prev) => ({ ...prev, [payload.branchId]: payload }));
  });

  return (
    <div>
      <PageHeader
        eyebrow="Sucursales"
        title="Elige dónde estacionar"
        subtitle="La ocupación se actualiza en tiempo real. Al reservar, el sistema asigna automáticamente la primera cochera disponible del tipo que elijas."
      />

      {!branches ? (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      ) : branches.length === 0 ? (
        <EmptyState title="Sin sucursales" description="Aún no hay sucursales registradas en el sistema." />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              occupancy={occupancyByBranch[branch.id]}
              onReserve={() => setSelectedBranch(branch)}
            />
          ))}
        </div>
      )}

      <ReservationModal branch={selectedBranch} onClose={() => setSelectedBranch(null)} />
    </div>
  );
}
