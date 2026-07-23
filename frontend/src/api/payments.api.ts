import { api } from '@/lib/axios';
import type { Payment } from '@/types/entities';
import type { PaymentMethodType } from '@/types/enums';

export const paymentsApi = {
  create: (sessionId: string, method: PaymentMethodType) =>
    api.post<Payment>('/payments', { sessionId, method }).then((r) => r.data),
  getById: (id: string) => api.get<Payment>(`/payments/${id}`).then((r) => r.data),
};
