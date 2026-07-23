import { ParkingSession, ParkingSessionProps } from '../../../domain/entities/parking-session.entity';
import { Payment, PaymentProps } from '../../../domain/entities/payment.entity';
import { Reservation, ReservationProps } from '../../../domain/entities/reservation.entity';
import { PaymentStatus } from '../../../domain/enums/payment-status.enum';
import { ReservationStatus } from '../../../domain/enums/reservation-status.enum';
import { SessionStatus } from '../../../domain/enums/session-status.enum';
import { SlotType } from '../../../domain/enums/slot-type.enum';
import { OverstayPaymentInsufficientError } from '../../../domain/errors/overstay-payment-insufficient.error';
import { PaymentNotApprovedError } from '../../../domain/errors/payment-not-approved.error';
import { SessionNotActiveError } from '../../../domain/errors/session-not-active.error';
import type { ParkingPolicy } from '../../../domain/policies/parking.policy';
import type { PricingPolicy } from '../../../domain/policies/pricing.policy';
import type { ParkingSessionRepositoryPort } from '../../../domain/ports/parking-session.repository.port';
import type { PaymentRepositoryPort } from '../../../domain/ports/payment.repository.port';
import type { ReservationRepositoryPort } from '../../../domain/ports/reservation.repository.port';
import type { ClockPort } from '../../ports/clock.port';
import type { QrCodePort } from '../../ports/qr-code.port';
import type { RealtimeNotifierPort } from '../../ports/realtime-notifier.port';
import { RegisterExitUseCase } from './register-exit.use-case';

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
    amount: 10,
    status: PaymentStatus.APPROVED,
    externalReference: 'MOCK-1',
    paidAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  });
}

describe('RegisterExitUseCase', () => {
  const qrCode: jest.Mocked<QrCodePort> = {
    signEntryToken: jest.fn(),
    signExitToken: jest.fn(),
    verify: jest.fn(),
  };
  const parkingPolicy: jest.Mocked<ParkingPolicy> = {
    registerEntry: jest.fn(),
    registerExit: jest.fn(),
    releaseSlot: jest.fn(),
  };
  const pricingPolicy: jest.Mocked<PricingPolicy> = {
    calculate: jest.fn(),
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
  const sessionsRepo: jest.Mocked<ParkingSessionRepositoryPort> = {
    findById: jest.fn(),
    findActiveByUser: jest.fn(),
    findByReservationId: jest.fn(),
    create: jest.fn(),
    markCompleted: jest.fn(),
    listByUser: jest.fn(),
  };
  const paymentsRepo: jest.Mocked<PaymentRepositoryPort> = {
    findById: jest.fn(),
    findBySessionId: jest.fn(),
    create: jest.fn(),
    increaseAmount: jest.fn(),
    listByUser: jest.fn(),
    sumApprovedAmountByBranch: jest.fn(),
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

  let useCase: RegisterExitUseCase;
  const now = new Date('2026-07-22T12:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    clock.now.mockReturnValue(now);
    qrCode.verify.mockReturnValue({ type: 'EXIT', sessionId: 'session-1', expiresAt: now.getTime() + 60_000 });
    useCase = new RegisterExitUseCase(
      qrCode,
      parkingPolicy,
      pricingPolicy,
      clock,
      notifier,
      sessionsRepo,
      paymentsRepo,
      reservationsRepo,
    );
  });

  it('lanza SessionNotActiveError si la sesion no existe o no esta activa', async () => {
    sessionsRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute({ qrPayload: 'qr' })).rejects.toThrow(SessionNotActiveError);
    expect(pricingPolicy.calculate).not.toHaveBeenCalled();
  });

  it('lanza PaymentNotApprovedError si no hay pago aprobado', async () => {
    sessionsRepo.findById.mockResolvedValue(buildSession());
    reservationsRepo.findById.mockResolvedValue(buildReservation());
    paymentsRepo.findBySessionId.mockResolvedValue(buildPayment({ status: PaymentStatus.PENDING }));

    await expect(useCase.execute({ qrPayload: 'qr' })).rejects.toThrow(PaymentNotApprovedError);
    expect(pricingPolicy.calculate).not.toHaveBeenCalled();
  });

  it('lanza OverstayPaymentInsufficientError si el pago no cubre la tarifa recalculada al momento real de salida', async () => {
    sessionsRepo.findById.mockResolvedValue(buildSession());
    reservationsRepo.findById.mockResolvedValue(buildReservation());
    paymentsRepo.findBySessionId.mockResolvedValue(buildPayment({ amount: 5 }));
    pricingPolicy.calculate.mockResolvedValue({ amount: 12.5, currency: 'PEN', breakdown: [] });

    await expect(useCase.execute({ qrPayload: 'qr' })).rejects.toThrow(OverstayPaymentInsufficientError);
    expect(parkingPolicy.registerExit).not.toHaveBeenCalled();
  });

  it('no rechaza por diferencias de centavos dentro de la tolerancia', async () => {
    const session = buildSession();
    const completedSession = buildSession({ status: SessionStatus.COMPLETED, exitAt: now });
    sessionsRepo.findById.mockResolvedValue(session);
    reservationsRepo.findById.mockResolvedValue(buildReservation());
    paymentsRepo.findBySessionId.mockResolvedValue(buildPayment({ amount: 10 }));
    pricingPolicy.calculate.mockResolvedValue({ amount: 10.005, currency: 'PEN', breakdown: [] });
    parkingPolicy.registerExit.mockResolvedValue({ outcome: 'RELEASED', session: completedSession });

    await expect(useCase.execute({ qrPayload: 'qr' })).resolves.toBe(completedSession);
  });

  it('procede con la salida cuando el pago cubre la tarifa recalculada', async () => {
    const completedSession = buildSession({ status: SessionStatus.COMPLETED, exitAt: now });
    sessionsRepo.findById.mockResolvedValue(buildSession());
    reservationsRepo.findById.mockResolvedValue(buildReservation());
    paymentsRepo.findBySessionId.mockResolvedValue(buildPayment({ amount: 10 }));
    pricingPolicy.calculate.mockResolvedValue({ amount: 10, currency: 'PEN', breakdown: [] });
    parkingPolicy.registerExit.mockResolvedValue({ outcome: 'RELEASED', session: completedSession });

    const result = await useCase.execute({ qrPayload: 'qr' });

    expect(parkingPolicy.registerExit).toHaveBeenCalledWith({ sessionId: 'session-1', now });
    expect(notifier.notifyExitRegistered).toHaveBeenCalledWith({
      sessionId: completedSession.id,
      branchId: 'branch-1',
      slotId: completedSession.slotId,
    });
    expect(notifier.notifyOccupancyUpdated).toHaveBeenCalledWith('branch-1');
    expect(result).toBe(completedSession);
  });
});
