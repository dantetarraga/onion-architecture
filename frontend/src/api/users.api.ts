import { api } from '@/lib/axios';
import type { AuthUser, ParkingSession, Payment, Reservation } from '@/types/entities';

export const usersApi = {
  me: () => api.get<AuthUser>('/users/me').then((r) => r.data),
  myReservations: () => api.get<Reservation[]>('/users/me/reservations').then((r) => r.data),
  mySessions: () => api.get<ParkingSession[]>('/users/me/sessions').then((r) => r.data),
  myPayments: () => api.get<Payment[]>('/users/me/payments').then((r) => r.data),
};
