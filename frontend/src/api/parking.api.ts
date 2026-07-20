import { api } from '@/lib/axios';
import type { ParkingSession, PricingResult } from '@/types/entities';

export const parkingApi = {
  entryQr: (reservationId: string) =>
    api.get<{ qrPayload: string }>(`/reservations/${reservationId}/qr`).then((r) => r.data),
  registerEntry: (qrPayload: string) =>
    api.post<ParkingSession>('/parking/entry', { qrPayload }).then((r) => r.data),
  exitQr: (sessionId: string) =>
    api.get<{ qrPayload: string }>(`/parking/sessions/${sessionId}/qr`).then((r) => r.data),
  registerExit: (qrPayload: string) =>
    api.post<ParkingSession>('/parking/exit', { qrPayload }).then((r) => r.data),
  amount: (sessionId: string) => api.get<PricingResult>(`/parking/sessions/${sessionId}/amount`).then((r) => r.data),
  reportBlocked: (slotId: string) => api.post<void>(`/parking/slots/${slotId}/report-blocked`).then((r) => r.data),
};
