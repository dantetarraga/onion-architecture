export interface SessionQuote {
  sessionId: string;
  userId: string;
  branchId: string;
  active: boolean;
  amount: number;
  currency: 'PEN';
  breakdown: { label: string; amount: number }[];
}

/**
 * Cotizacion de una sesion de estacionamiento, calculada por su dueño
 * (backend: sesiones + PricingPolicy con la tarifa de la sucursal). Lanza
 * NotFoundError (remoto) si la sesion no existe, o
 * ParkingServiceUnavailableError si backend no responde.
 */
export interface SessionBillingPort {
  getQuote(sessionId: string): Promise<SessionQuote>;
}
