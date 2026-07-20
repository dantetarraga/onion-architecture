import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { branchesApi } from '@/api/branches.api';
import { reservationsApi } from '@/api/reservations.api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { SLOT_TYPE_LABEL } from '@/types/enums';
import type { SlotType } from '@/types/enums';
import type { Branch, SlotAvailabilityCount } from '@/types/entities';

interface ReservationModalProps {
  branch: Branch | null;
  onClose: () => void;
}

export function ReservationModal({ branch, onClose }: ReservationModalProps) {
  const [availability, setAvailability] = useState<SlotAvailabilityCount[] | null>(null);
  const [slotType, setSlotType] = useState<SlotType | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [suggestion, setSuggestion] = useState<{ suggestedBranch: Branch; distanceKm: number } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!branch) return;
    setAvailability(null);
    setSlotType('');
    setSuggestion(null);
    branchesApi
      .availability(branch.id)
      .then((result) => setAvailability(result.availability))
      .catch((error) => notifyError(error));
  }, [branch]);

  if (!branch) return null;

  async function handleConfirm(targetBranchId: string, isSuggestion: boolean) {
    setSubmitting(true);
    try {
      const result = isSuggestion
        ? await reservationsApi.confirmSuggestion(targetBranchId, slotType || undefined)
        : await reservationsApi.create(targetBranchId, slotType || undefined);

      if (result.outcome === 'CREATED') {
        notifySuccess('Reserva creada. Tienes 20 minutos para hacer check-in.');
        onClose();
        navigate('/mi-reserva');
        return;
      }

      setSuggestion({ suggestedBranch: result.suggestedBranch, distanceKm: result.distanceKm });
    } catch (error) {
      notifyError(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={suggestion ? 'Sucursal sugerida' : `Reservar en ${branch.name}`}>
      {suggestion ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-asphalt">
            <strong>{branch.name}</strong> no tiene cupo disponible ahora mismo. La sucursal más cercana con
            disponibilidad es:
          </p>
          <div className="rounded-sm border border-steel-100 bg-concrete px-4 py-3">
            <p className="font-display text-lg text-asphalt">{suggestion.suggestedBranch.name}</p>
            <p className="text-sm text-steel">{suggestion.suggestedBranch.address}</p>
            <p className="mt-1 font-mono text-xs text-signal-yellow-600">
              {suggestion.distanceKm.toFixed(1)} km de distancia
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              loading={submitting}
              onClick={() => handleConfirm(suggestion.suggestedBranch.id, true)}
              className="flex-1"
            >
              Reservar aquí
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {!availability ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : (
            <Select
              label="Tipo de cochera"
              value={slotType}
              onChange={(event) => setSlotType(event.target.value as SlotType | '')}
            >
              <option value="">Cualquiera disponible</option>
              {availability.map((slot) => (
                <option key={slot.type} value={slot.type} disabled={slot.available === 0}>
                  {SLOT_TYPE_LABEL[slot.type]} — {slot.available}/{slot.total} libres
                </option>
              ))}
            </Select>
          )}

          <Button loading={submitting} disabled={!availability} onClick={() => handleConfirm(branch.id, false)}>
            Confirmar reserva
          </Button>
        </div>
      )}
    </Modal>
  );
}
