import { Payment, PaymentProps } from '../../../domain/entities/payment.entity';
import { PaymentMethodType } from '../../../domain/enums/payment-method-type.enum';
import { PaymentStatus } from '../../../domain/enums/payment-status.enum';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { PaymentMethod } from '../../../ports/out/payment-method.port';
import type { PaymentEventsPort } from '../../../ports/out/payment-events.port';
import type { PaymentRepositoryPort } from '../../../ports/out/payment.repository.port';
import type {
  SessionBillingPort,
  SessionQuote,
} from '../../../ports/out/session-billing.port';
import type { ClockPort } from '../../../ports/out/clock.port';
import { RegisterPaymentUseCase } from './register-payment.use-case';

function buildQuote(overrides: Partial<SessionQuote> = {}): SessionQuote {
  return {
    sessionId: 'session-1',
    userId: 'user-1',
    branchId: 'branch-1',
    active: true,
    amount: 8,
    currency: 'PEN',
    breakdown: [],
    ...overrides,
  };
}

function buildPayment(overrides: Partial<PaymentProps> = {}): Payment {
  return new Payment({
    id: 'payment-1',
    sessionId: 'session-1',
    userId: 'user-1',
    branchId: 'branch-1',
    amount: 5,
    status: PaymentStatus.APPROVED,
    externalReference: 'MOCK-1',
    paidAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  });
}

describe('RegisterPaymentUseCase', () => {
  const billing: jest.Mocked<SessionBillingPort> = {
    getQuote: jest.fn(),
  };
  const paymentsRepo: jest.Mocked<PaymentRepositoryPort> = {
    findById: jest.fn(),
    findBySessionId: jest.fn(),
    create: jest.fn(),
    increaseAmount: jest.fn(),
    listByUser: jest.fn(),
    sumApprovedByBranch: jest.fn(),
  };
  const paymentMethod: jest.Mocked<PaymentMethod> = {
    charge: jest.fn(),
  };
  const clock: jest.Mocked<ClockPort> = {
    now: jest.fn(),
  };
  const events: jest.Mocked<PaymentEventsPort> = {
    paymentRegistered: jest.fn(),
  };
  const auditEvents = {
    publishPaymentRegistered: jest.fn().mockResolvedValue(undefined),
  };

  let useCase: RegisterPaymentUseCase;
  const now = new Date('2026-07-22T12:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    clock.now.mockReturnValue(now);
    billing.getQuote.mockResolvedValue(buildQuote());
    useCase = new RegisterPaymentUseCase(
      billing,
      paymentsRepo,
      paymentMethod,
      clock,
      events,
      auditEvents,
    );
  });

  it('lanza NotFoundError si la sesion no pertenece al usuario', async () => {
    billing.getQuote.mockResolvedValue(buildQuote({ userId: 'other-user' }));

    await expect(
      useCase.execute({
        sessionId: 'session-1',
        userId: 'user-1',
        method: PaymentMethodType.CASH,
      }),
    ).rejects.toThrow(NotFoundError);
    expect(paymentMethod.charge).not.toHaveBeenCalled();
  });

  it('crea un pago nuevo (con la sucursal de la cotizacion) cuando la sesion todavia no tiene ninguno', async () => {
    paymentsRepo.findBySessionId.mockResolvedValue(null);
    paymentMethod.charge.mockResolvedValue({
      status: 'APPROVED',
      externalReference: 'MOCK-NEW',
    });
    paymentsRepo.create.mockResolvedValue(buildPayment({ amount: 8 }));

    const result = await useCase.execute({
      sessionId: 'session-1',
      userId: 'user-1',
      method: PaymentMethodType.CASH,
    });

    expect(paymentsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        branchId: 'branch-1',
        amount: 8,
        status: PaymentStatus.APPROVED,
      }),
    );
    expect(events.paymentRegistered).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'payment-1', amount: 8 }),
    );
    expect(auditEvents.publishPaymentRegistered).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'payment-1',
        sessionId: 'session-1',
        userId: 'user-1',
        status: PaymentStatus.APPROVED,
      }),
    );
    expect(result.amount).toBe(8);
  });

  it('devuelve el pago existente sin cobrar de nuevo si ya cubre la tarifa recalculada', async () => {
    const existing = buildPayment({ amount: 10 });
    paymentsRepo.findBySessionId.mockResolvedValue(existing);
    billing.getQuote.mockResolvedValue(buildQuote({ amount: 10 }));

    const result = await useCase.execute({
      sessionId: 'session-1',
      userId: 'user-1',
      method: PaymentMethodType.CASH,
    });

    expect(paymentMethod.charge).not.toHaveBeenCalled();
    expect(paymentsRepo.increaseAmount).not.toHaveBeenCalled();
    expect(events.paymentRegistered).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it('cobra y suma solo la diferencia cuando el pago existente no cubre la sobre-estadia (E3, top-up)', async () => {
    const existing = buildPayment({ amount: 5 });
    paymentsRepo.findBySessionId.mockResolvedValue(existing);
    billing.getQuote.mockResolvedValue(buildQuote({ amount: 12 }));
    paymentMethod.charge.mockResolvedValue({
      status: 'APPROVED',
      externalReference: 'MOCK-TOPUP',
    });
    paymentsRepo.increaseAmount.mockResolvedValue(
      buildPayment({ amount: 12, externalReference: 'MOCK-1,MOCK-TOPUP' }),
    );

    const result = await useCase.execute({
      sessionId: 'session-1',
      userId: 'user-1',
      method: PaymentMethodType.CASH,
    });

    expect(paymentMethod.charge).toHaveBeenCalledWith({
      sessionId: 'session-1',
      amount: 7,
      currency: 'PEN',
      method: PaymentMethodType.CASH,
    });
    expect(paymentsRepo.increaseAmount).toHaveBeenCalledWith(
      'payment-1',
      7,
      'MOCK-TOPUP',
      now,
    );
    expect(paymentsRepo.create).not.toHaveBeenCalled();
    expect(result.amount).toBe(12);
  });

  it('mantiene el pago original si el cobro de la diferencia es rechazado', async () => {
    const existing = buildPayment({ amount: 5 });
    paymentsRepo.findBySessionId.mockResolvedValue(existing);
    billing.getQuote.mockResolvedValue(buildQuote({ amount: 12 }));
    paymentMethod.charge.mockResolvedValue({
      status: 'REJECTED',
      externalReference: 'MOCK-REJECTED',
    });

    const result = await useCase.execute({
      sessionId: 'session-1',
      userId: 'user-1',
      method: PaymentMethodType.CASH,
    });

    expect(paymentsRepo.increaseAmount).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });
});
