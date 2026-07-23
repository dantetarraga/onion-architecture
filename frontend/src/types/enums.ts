export type Role = 'USER' | 'ADMIN';

export type SlotType = 'REGULAR' | 'MOTO' | 'ELECTRICO' | 'DISCAPACITADOS';

export type SlotStatus = 'DISPONIBLE' | 'RESERVADA' | 'OCUPADA' | 'NO_DISPONIBLE';

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED' | 'COMPLETED';

export type SessionStatus = 'ACTIVE' | 'COMPLETED';

export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type OccupancyLevel = 'GREEN' | 'YELLOW' | 'RED';

export type PaymentMethodType = 'CASH' | 'CARD' | 'YAPE' | 'PLIN';

export const SLOT_TYPE_LABEL: Record<SlotType, string> = {
  REGULAR: 'Regular',
  MOTO: 'Moto',
  ELECTRICO: 'Eléctrico',
  DISCAPACITADOS: 'Discapacitados',
};

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  EXPIRED: 'Expirada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethodType, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  YAPE: 'Yape',
  PLIN: 'Plin',
};
