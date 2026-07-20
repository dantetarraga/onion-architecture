import { api } from '@/lib/axios';
import type { CreateReservationResult, Reservation } from '@/types/entities';
import type { ReservationStatus, SlotType } from '@/types/enums';

export const reservationsApi = {
  create: (branchId: string, slotType?: SlotType) =>
    api.post<CreateReservationResult>('/reservations', { branchId, slotType }).then((r) => r.data),
  confirmSuggestion: (suggestedBranchId: string, slotType?: SlotType) =>
    api
      .post<CreateReservationResult>('/reservations/confirm-suggestion', { suggestedBranchId, slotType })
      .then((r) => r.data),
  listAdmin: (params?: { branchId?: string; status?: ReservationStatus }) =>
    api.get<Reservation[]>('/reservations', { params }).then((r) => r.data),
  getById: (id: string) => api.get<Reservation>(`/reservations/${id}`).then((r) => r.data),
  cancel: (id: string) => api.patch<void>(`/reservations/${id}/cancel`).then((r) => r.data),
};
