/**
 * Hechos de pago que otros servicios quieren ver. Hoy: el dashboard de admin
 * en tiempo real (realtime-service los reemite por socket.io).
 */
export interface PaymentEventsPort {
  paymentRegistered(payload: {
    paymentId: string;
    sessionId: string;
    branchId: string;
    amount: number;
    status: string;
  }): void;
}
