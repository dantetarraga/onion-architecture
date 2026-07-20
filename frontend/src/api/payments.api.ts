import { api } from '@/lib/axios';
import type { Payment } from '@/types/entities';

export const paymentsApi = {
  create: (sessionId: string) => api.post<Payment>('/payments', { sessionId }).then((r) => r.data),
  getById: (id: string) => api.get<Payment>(`/payments/${id}`).then((r) => r.data),
};
