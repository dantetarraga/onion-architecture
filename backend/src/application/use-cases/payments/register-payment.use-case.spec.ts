import { ParkingSession, ParkingSessionProps } from '../../../domain/entities/parking-session.entity';
import { Payment, PaymentProps } from '../../../domain/entities/payment.entity';
import { Reservation, ReservationProps } from '../../../domain/entities/reservation.entity';
import { PaymentMethodType } from '../../../domain/enums/payment-method-type.enum';
import { PaymentStatus } from '../../../domain/enums/payment-status.enum';
import { ReservationStatus } from '../../../domain/enums/reservation-status.enum';
import { SessionStatus } from '../../../domain/enums/session-status.enum';
import { SlotType } from '../../../domain/enums/slot-type.enum';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { PaymentMethod } from '../../../domain/policies/payment-method.port';
import type { PricingPolicy } from '../../../domain/policies/pricing.policy';
import type { ParkingSessionRepositoryPort } from '../../../domain/ports/parking-session.repository.port';
import type { PaymentRepositoryPort } from '../../../domain/ports/payment.repository.port';
import type { ReservationRepositoryPort } from '../../../domain/ports/reservation.repository.port';
import type { ClockPort } from '../../ports/clock.port';
import type { RealtimeNotifierPort } from '../../ports/realtime-notifier.port';
import { RegisterPaymentUseCase } from './register-payment.use-case';

function buildReservation(overrides: Partial<ReservationProps> = {}): Reservation {
  return new Reservation({
    id: 'reservation-1',
    userId: 'user-1',
    branchId: 'branch-1',
    slotId: 'slot-1',
    requestedType: SlotType.REGULAR,
    status: ReservationStatus.CONFIRMED,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    confirmedAt: new Date(),
    ...overrides,
  });
}

function buildSession(overrides: Partial<ParkingSessionProps> = {}): ParkingSession {
  return new ParkingSession({
    id: 'session-1',
    reservationId: 'reservation-1',
    userId: 'user-1',
    slotId: 'slot-1',
    status: SessionStatus.ACTIVE,
    entryAt: new Date(),
    exitAt: null,
    ...overrides,
  });
}

function buildPayment(overrides: Partial<PaymentProps> = {}): Payment {
  return new Payment({
    id: 'payment-1',
    sessionId: 'session-1',
    userId: 'user-1',
    amount: 5,
    status: PaymentStatus.APPROVED,
    externalReference: 'MOCK-1',
    paidAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  });
}

describe('RegisterPaymentUseCase', () => {
  const sessionsRepo: jest.Mocked<ParkingSessionRepositoryPort> = {
    findById: jest.fn(),
    findActiveByUser: jest.fn(),
    findByReservationId: jest.fn(),
    create: jest.fn(),
    markCompleted: jest.fn(),
    listByUser: jest.fn(),
  };
  const reservationsRepo: jest.Mocked<ReservationRepositoryPort> = {
    findById: jest.fn(),
    findActiveByUser: jest.fn(),
    findExpiredPending: jest.fn(),
    create: jest.fn(),
    updateStatus: jest.fn(),
    listByUser: jest.fn(),
    listByFilters: jest.fn(),
  };
  const paymentsRepo: jest.Mocked<PaymentRepositoryPort> = {
    findById: jest.fn(),
    findBySessionId: jest.fn(),
    create: jest.fn(),
    increaseAmount: jest.fn(),
    listByUser: jest.fn(),
    sumApprovedAmountByBranch: jest.fn(),
  };
  const pricingPolicy: jest.Mocked<PricingPolicy> = {
    calculate: jest.fn(),
  };
  const paymentMethod: jest.Mocked<PaymentMethod> = {
    charge: jest.fn(),
  };
  const clock: jest.Mocked<ClockPort> = {
    now: jest.fn(),
  };
  const notifier: jest.Mocked<RealtimeNotifierPort> = {
    notifyReservationCreated: jest.fn(),
    notifyReservationExpired: jest.fn(),
    notifyReservationCancelled: jest.fn(),
    notifySlotStatusChanged: jest.fn(),
    notifyOccupancyUpdated: jest.fn(),
    notifyEntryRegistered: jest.fn(),
    notifyExitRegistered: jest.fn(),
    notifyPaymentRegistered: jest.fn(),
  };

  let useCase: RegisterPaymentUseCase;
  const now = new Date('2026-07-22T12:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    clock.now.mockReturnValue(now);
    sessionsRepo.findById.mockResolvedValue(buildSession());
    reservationsRepo.findById.mockResolvedValue(buildReservation());
    useCase = new RegisterPaymentUseCase(
      sessionsRepo,
      reservationsRepo,
      paymentsRepo,
      pricingPolicy,
      paymentMethod,
      clock,
      notifier,
    );
  });

  it('lanza NotFoundError si la sesion no pertenece al usuario', async () => {
    sessionsRepo.findById.mockResolvedValue(buildSession({ userId: 'other-user' }));

    await expect(
      useCase.execute({ sessionId: 'session-1', userId: 'user-1', method: PaymentMethodType.CASH }),
    ).rejects.toThrow(NotFoundError);
  });

  it('crea un pago nuevo cuando la sesion todavia no tiene ninguno', async () => {
    paymentsRepo.findBySessionId.mockResolvedValue(null);
    pricingPolicy.calculate.mockResolvedValue({ amount: 8, currency: 'PEN', breakdown: [] });
    paymentMethod.charge.mockResolvedValue({ status: 'APPROVED', externalReference: 'MOCK-NEW' });
    paymentsRepo.create.mockResolvedValue(buildPayment({ amount: 8 }));

    const result = await useCase.execute({ sessionId: 'session-1', userId: 'user-1', method: PaymentMethodType.CASH });

    expect(paymentsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-1', amount: 8, status: PaymentStatus.APPROVED }),
    );
    expect(result.amount).toBe(8);
  });

  it('devuelve el pago existente sin cobrar de nuevo si ya cubre la tarifa recalculada', async () => {
    const existing = buildPayment({ amount: 10 });
    paymentsRepo.findBySessionId.mockResolvedValue(existing);
    pricingPolicy.calculate.mockResolvedValue({ amount: 10, currency: 'PEN', breakdown: [] });

    const result = await useCase.execute({ sessionId: 'session-1', userId: 'user-1', method: PaymentMethodType.CASH });

    expect(paymentMethod.charge).not.toHaveBeenCalled();
    expect(paymentsRepo.increaseAmount).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it('cobra y suma solo la diferencia cuando el pago existente no cubre la sobre-estadia (E3, top-up)', async () => {
    const existing = buildPayment({ amount: 5 });
    paymentsRepo.findBySessionId.mockResolvedValue(existing);
    pricingPolicy.calculate.mockResolvedValue({ amount: 12, currency: 'PEN', breakdown: [] });
    paymentMethod.charge.mockResolvedValue({ status: 'APPROVED', externalReference: 'MOCK-TOPUP' });
    paymentsRepo.increaseAmount.mockResolvedValue(buildPayment({ amount: 12, externalReference: 'MOCK-1,MOCK-TOPUP' }));

    const result = await useCase.execute({ sessionId: 'session-1', userId: 'user-1', method: PaymentMethodType.CASH });

    expect(paymentMethod.charge).toHaveBeenCalledWith({
      sessionId: 'session-1',
      amount: 7,
      currency: 'PEN',
      method: PaymentMethodType.CASH,
    });
    expect(paymentsRepo.increaseAmount).toHaveBeenCalledWith('payment-1', 7, 'MOCK-TOPUP', now);
    expect(paymentsRepo.create).not.toHaveBeenCalled();
    expect(result.amount).toBe(12);
  });

  it('mantiene el pago original si el cobro de la diferencia es rechazado', async () => {
    const existing = buildPayment({ amount: 5 });
    paymentsRepo.findBySessionId.mockResolvedValue(existing);
    pricingPolicy.calculate.mockResolvedValue({ amount: 12, currency: 'PEN', breakdown: [] });
    paymentMethod.charge.mockResolvedValue({ status: 'REJECTED', externalReference: 'MOCK-REJECTED' });

    const result = await useCase.execute({ sessionId: 'session-1', userId: 'user-1', method: PaymentMethodType.CASH });

    expect(paymentsRepo.increaseAmount).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });
});
