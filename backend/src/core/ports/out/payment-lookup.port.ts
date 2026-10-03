import { Payment } from '../../domain/entities/payment.entity';

export interface BranchRevenue {
  branchId: string;
  total: number;
}

/**
 * Vista de solo lectura de los pagos, que desde la extraccion viven en
 * payments-service (base propia). backend ya no cobra ni persiste pagos: solo
 * necesita saber si una sesion esta pagada (para liberar la cochera en la
 * salida) y cuanto se cobro por sucursal (reporte de ingresos del admin).
 *
 * Ambos metodos lanzan PaymentServiceUnavailableError si payments-service no
 * responde: no se puede decidir una salida "a ciegas".
 */
export interface PaymentLookupPort {
  findBySessionId(sessionId: string): Promise<Payment | null>;
  /** Una fila por cada `branchIds` pedido (0 si no tiene pagos aprobados en el rango). */
  sumApprovedByBranch(
    branchIds: string[],
    from?: Date,
    to?: Date,
  ): Promise<BranchRevenue[]>;
}
