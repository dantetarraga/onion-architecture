import { Inject, Injectable } from '@nestjs/common';
import { Payment } from '../../../domain/entities/payment.entity';
import { PaymentMethodType } from '../../../domain/enums/payment-method-type.enum';
import { PaymentStatus } from '../../../domain/enums/payment-status.enum';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { PaymentMethod } from '../../../ports/out/payment-method.port';
import type { PaymentEventsPort } from '../../../ports/out/payment-events.port';
import type { AuditEventPublisherPort } from '../../../ports/out/audit-event-publisher.port';
import type { PaymentRepositoryPort } from '../../../ports/out/payment.repository.port';
import type { SessionBillingPort } from '../../../ports/out/session-billing.port';
import type { ClockPort } from '../../../ports/out/clock.port';
import {
  CLOCK,
  AUDIT_EVENT_PUBLISHER,
  PAYMENT_EVENTS,
  PAYMENT_METHOD,
  PAYMENT_REPOSITORY,
  SESSION_BILLING,
} from '../../../ports/out/tokens';
import type { RegisterPaymentPort } from '../../../ports/in/payments/register-payment.port';

export interface RegisterPaymentInput {
  sessionId: string;
  userId: string;
  method: PaymentMethodType;
}

const TOLERANCE = 0.01;

@Injectable()
export class RegisterPaymentUseCase implements RegisterPaymentPort {
  constructor(
    @Inject(SESSION_BILLING) private readonly billing: SessionBillingPort,
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepositoryPort,
    @Inject(PAYMENT_METHOD) private readonly paymentMethod: PaymentMethod,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(PAYMENT_EVENTS) private readonly events: PaymentEventsPort,
    @Inject(AUDIT_EVENT_PUBLISHER)
    private readonly auditEvents: AuditEventPublisherPort,
  ) {}

  async execute(input: RegisterPaymentInput): Promise<Payment> {
    // La sesion y la tarifa viven en backend: se pide la cotizacion al
    // momento actual (misma regla que en el monolito: pricing con exitAt = ahora).
    const quote = await this.billing.getQuote(input.sessionId);
    if (quote.userId !== input.userId) {
      throw new NotFoundError('ParkingSession', input.sessionId);
    }

    const now = this.clock.now();

    const existingPayment = await this.payments.findBySessionId(quote.sessionId);
    if (existingPayment) {
      return this.topUpIfInsufficient(
        existingPayment,
        quote.amount,
        quote.currency,
        quote.sessionId,
        now,
        input.method,
      );
    }

    const charge = await this.paymentMethod.charge({
      sessionId: quote.sessionId,
      amount: quote.amount,
      currency: quote.currency,
      method: input.method,
    });

    const payment = await this.payments.create({
      sessionId: quote.sessionId,
      userId: quote.userId,
      branchId: quote.branchId,
      amount: quote.amount,
      status:
        charge.status === 'APPROVED'
          ? PaymentStatus.APPROVED
          : PaymentStatus.REJECTED,
      externalReference: charge.externalReference,
      paidAt: charge.status === 'APPROVED' ? now : null,
    });

    this.publish(payment);
    return payment;
  }

  /**
   * Regulariza un pago existente si la tarifa recalculada al momento actual (sobre-estadia,
   * ver E3/RegisterExitUseCase en backend) supera lo ya pagado. Como `sessionId` es @unique en
   * `payments`, no se crea una fila nueva: se incrementa el monto del pago existente.
   */
  private async topUpIfInsufficient(
    existingPayment: Payment,
    requiredAmount: number,
    currency: 'PEN',
    sessionId: string,
    now: Date,
    method: PaymentMethodType,
  ): Promise<Payment> {
    const missingAmount = Number(
      (requiredAmount - existingPayment.amount).toFixed(2),
    );
    if (missingAmount <= TOLERANCE) {
      return existingPayment;
    }

    const charge = await this.paymentMethod.charge({
      sessionId,
      amount: missingAmount,
      currency,
      method,
    });
    if (charge.status !== 'APPROVED') {
      return existingPayment;
    }

    const toppedUp = await this.payments.increaseAmount(
      existingPayment.id,
      missingAmount,
      charge.externalReference,
      now,
    );

    this.publish(toppedUp);
    return toppedUp;
  }

  private publish(payment: Payment): void {
    this.events.paymentRegistered({
      paymentId: payment.id,
      sessionId: payment.sessionId,
      branchId: payment.branchId,
      amount: payment.amount,
      status: payment.status,
    });
    void this.auditEvents.publishPaymentRegistered({
      paymentId: payment.id,
      sessionId: payment.sessionId,
      branchId: payment.branchId,
      userId: payment.userId,
      amount: payment.amount,
      status: payment.status,
      occurredAt: payment.createdAt.toISOString(),
    });
  }
}
