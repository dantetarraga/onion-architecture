import { api } from "@/lib/axios";
import type { Reservation, ReservationRequestAccepted } from "@/types/entities";
import type { ReservationStatus, SlotType } from "@/types/enums";

export const reservationsApi = {
  /** Encola la solicitud; responde 202 y el resultado llega por WebSocket. */
  create: (branchId: string, slotType?: SlotType, startAt?: string) =>
    api
      .post<ReservationRequestAccepted>("/reservations", {
        branchId,
        slotType,
        startAt,
      })
      .then((r) => r.data),
  confirmSuggestion: (
    suggestedBranchId: string,
    slotType?: SlotType,
    startAt?: string,
  ) =>
    api
      .post<ReservationRequestAccepted>("/reservations/confirm-suggestion", {
        suggestedBranchId,
        slotType,
        startAt,
      })
      .then((r) => r.data),
  listAdmin: (params?: { branchId?: string; status?: ReservationStatus }) =>
    api.get<Reservation[]>("/reservations", { params }).then((r) => r.data),
  getById: (id: string) =>
    api.get<Reservation>(`/reservations/${id}`).then((r) => r.data),
  cancel: (id: string) =>
    api.patch<void>(`/reservations/${id}/cancel`).then((r) => r.data),
};
