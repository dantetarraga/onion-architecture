import { ParkingSession, ParkingSessionProps } from '../../entities/parking-session.entity';
import { Payment, PaymentProps } from '../../entities/payment.entity';
import { Reservation, ReservationProps } from '../../entities/reservation.entity';
import { PaymentStatus } from '../../enums/payment-status.enum';
import { ReservationStatus } from '../../enums/reservation-status.enum';
import { SessionStatus } from '../../enums/session-status.enum';
import { SlotType } from '../../enums/slot-type.enum';
import { NotFoundError } from '../../errors/not-found.error';
import { ReservationExpiredError } from '../../errors/reservation-expired.error';
import { SessionAlreadyActiveError } from '../../errors/session-already-active.error';
import { ParkingSessionRepositoryPort } from '../../ports/parking-session.repository.port';
import { ParkingSlotRepositoryPort } from '../../ports/parking-slot.repository.port';
import { PaymentRepositoryPort } from '../../ports/payment.repository.port';
import { ReservationRepositoryPort } from '../../ports/reservation.repository.port';
import { DefaultParkingPolicy } from './default-parking.policy';

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
    confirmedAt: null,
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

describe('DefaultParkingPolicy', () => {
  const reservationsRepo: jest.Mocked<ReservationRepositoryPort> = {
    findById: jest.fn(),
    findActiveByUser: jest.fn(),
    findExpiredPending: jest.fn(),
    create: jest.fn(),
    updateStatus: jest.fn(),
    listByUser: jest.fn(),
    listByFilters: jest.fn(),
  };
  const sessionsRepo: jest.Mocked<ParkingSessionRepositoryPort> = {
    findById: jest.fn(),
    findActiveByUser: jest.fn(),
    findByReservationId: jest.fn(),
    create: jest.fn(),
    markCompleted: jest.fn(),
    listByUser: jest.fn(),
  };
  const slotsRepo: jest.Mocked<ParkingSlotRepositoryPort> = {
    findById: jest.fn(),
    countByBranchAndType: jest.fn(),
    hasAvailability: jest.fn(),
    claimAvailableSlot: jest.fn(),
    claimLeastRecentlyUsedSlot: jest.fn(),
    updateStatus: jest.fn(),
    getOccupancySummary: jest.fn(),
    markAllOccupied: jest.fn(),
  };
  const paymentsRepo: jest.Mocked<PaymentRepositoryPort> = {
    findById: jest.fn(),
    findBySessionId: jest.fn(),
    create: jest.fn(),
    increaseAmount: jest.fn(),
    listByUser: jest.fn(),
    sumApprovedAmountByBranch: jest.fn(),
  };

  let policy: DefaultParkingPolicy;

  beforeEach(() => {
    jest.clearAllMocks();
    policy = new DefaultParkingPolicy(reservationsRepo, sessionsRepo, slotsRepo, paymentsRepo);
  });

  describe('registerEntry', () => {
    it('lanza NotFoundError si la reserva no existe', async () => {
      reservationsRepo.findById.mockResolvedValue(null);

      await expect(policy.registerEntry({ reservationId: 'reservation-1', now: new Date() })).rejects.toThrow(
        NotFoundError,
      );
    });

    it('lanza ReservationExpiredError si la reserva ya no esta vigente', async () => {
      reservationsRepo.findById.mockResolvedValue(buildReservation({ status: ReservationStatus.EXPIRED }));

      await expect(policy.registerEntry({ reservationId: 'reservation-1', now: new Date() })).rejects.toThrow(
        ReservationExpiredError,
      );
    });

    it('lanza SessionAlreadyActiveError si la reserva ya tiene una sesion activa (anti-replay)', async () => {
      reservationsRepo.findById.mockResolvedValue(buildReservation());
      sessionsRepo.findByReservationId.mockResolvedValue(buildSession({ status: SessionStatus.ACTIVE }));

      await expect(policy.registerEntry({ reservationId: 'reservation-1', now: new Date() })).rejects.toThrow(
        SessionAlreadyActiveError,
      );
      expect(sessionsRepo.create).not.toHaveBeenCalled();
    });

    it('permite reingresar si la sesion previa de la reserva ya esta completada', async () => {
      reservationsRepo.findById.mockResolvedValue(buildReservation());
      sessionsRepo.findByReservationId.mockResolvedValue(buildSession({ status: SessionStatus.COMPLETED }));
      sessionsRepo.create.mockResolvedValue(buildSession());

      const session = await policy.registerEntry({ reservationId: 'reservation-1', now: new Date() });

      expect(session).toBeDefined();
      expect(sessionsRepo.create).toHaveBeenCalled();
    });

    it('crea la sesion y ocupa la cochera cuando no hay sesion activa previa', async () => {
      const now = new Date();
      reservationsRepo.findById.mockResolvedValue(buildReservation({ status: ReservationStatus.PENDING }));
      sessionsRepo.findByReservationId.mockResolvedValue(null);
      sessionsRepo.create.mockResolvedValue(buildSession());

      const session = await policy.registerEntry({ reservationId: 'reservation-1', now });

      expect(reservationsRepo.updateStatus).toHaveBeenCalledWith('reservation-1', ReservationStatus.CONFIRMED, now);
      expect(sessionsRepo.create).toHaveBeenCalledWith({
        reservationId: 'reservation-1',
        userId: 'user-1',
        slotId: 'slot-1',
        entryAt: now,
      });
      expect(slotsRepo.updateStatus).toHaveBeenCalledWith('slot-1', 'OCUPADA');
      expect(session).toBeDefined();
    });
  });

  describe('registerExit', () => {
    it('rechaza si no existe una sesion activa', async () => {
      sessionsRepo.findById.mockResolvedValue(null);

      const result = await policy.registerExit({ sessionId: 'session-1', now: new Date() });

      expect(result).toEqual({ outcome: 'REJECTED', reason: 'NO_ACTIVE_SESSION' });
    });

    it('rechaza si la sesion ya fue completada', async () => {
      sessionsRepo.findById.mockResolvedValue(buildSession({ status: SessionStatus.COMPLETED }));

      const result = await policy.registerExit({ sessionId: 'session-1', now: new Date() });

      expect(result).toEqual({ outcome: 'REJECTED', reason: 'NO_ACTIVE_SESSION' });
    });

    it('rechaza si no hay pago aprobado', async () => {
      sessionsRepo.findById.mockResolvedValue(buildSession());
      paymentsRepo.findBySessionId.mockResolvedValue(buildPayment({ status: PaymentStatus.PENDING }));

      const result = await policy.registerExit({ sessionId: 'session-1', now: new Date() });

      expect(result).toEqual({ outcome: 'REJECTED', reason: 'PAYMENT_NOT_APPROVED' });
    });

    it('libera la cochera y completa la reserva cuando el pago esta aprobado', async () => {
      const now = new Date();
      const activeSession = buildSession();
      const completedSession = buildSession({ status: SessionStatus.COMPLETED, exitAt: now });
      sessionsRepo.findById.mockResolvedValueOnce(activeSession).mockResolvedValueOnce(completedSession);
      paymentsRepo.findBySessionId.mockResolvedValue(buildPayment());

      const result = await policy.registerExit({ sessionId: 'session-1', now });

      expect(sessionsRepo.markCompleted).toHaveBeenCalledWith('session-1', now);
      expect(slotsRepo.updateStatus).toHaveBeenCalledWith('slot-1', 'DISPONIBLE');
      expect(reservationsRepo.updateStatus).toHaveBeenCalledWith('reservation-1', ReservationStatus.COMPLETED);
      expect(result).toEqual({ outcome: 'RELEASED', session: completedSession });
    });
  });
});
