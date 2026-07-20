import { Reservation, ReservationProps } from '../../entities/reservation.entity';
import { ReservationStatus } from '../../enums/reservation-status.enum';
import { SlotType } from '../../enums/slot-type.enum';
import { ParkingSessionRepositoryPort } from '../../ports/parking-session.repository.port';
import { ReservationRepositoryPort } from '../../ports/reservation.repository.port';
import { DefaultReservationPolicy } from './default-reservation.policy';

function buildReservation(overrides: Partial<ReservationProps> = {}): Reservation {
  return new Reservation({
    id: 'res-1',
    userId: 'user-1',
    branchId: 'branch-1',
    slotId: 'slot-1',
    requestedType: SlotType.REGULAR,
    status: ReservationStatus.PENDING,
    createdAt: new Date('2026-01-01T09:00:00Z'),
    expiresAt: new Date('2026-01-01T09:20:00Z'),
    confirmedAt: null,
    ...overrides,
  });
}

describe('DefaultReservationPolicy', () => {
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

  let policy: DefaultReservationPolicy;

  beforeEach(() => {
    jest.clearAllMocks();
    policy = new DefaultReservationPolicy(reservationsRepo, sessionsRepo, 20);
  });

  it('calcula la ventana de tolerancia de 20 minutos', () => {
    const createdAt = new Date('2026-01-01T21:00:00Z');
    expect(policy.calculateExpiresAt(createdAt).toISOString()).toBe('2026-01-01T21:20:00.000Z');
  });

  it('marca como expirada una reserva PENDING pasada la ventana de tolerancia', () => {
    const reservation = buildReservation();
    expect(policy.isExpired(reservation, new Date('2026-01-01T09:20:01Z'))).toBe(true);
  });

  it('no marca como expirada una reserva dentro de la ventana de tolerancia', () => {
    const reservation = buildReservation();
    expect(policy.isExpired(reservation, new Date('2026-01-01T09:19:59Z'))).toBe(false);
  });

  it('rechaza crear una reserva si el usuario ya tiene una reserva activa', async () => {
    reservationsRepo.findActiveByUser.mockResolvedValue(buildReservation());
    const result = await policy.canCreateReservation('user-1');
    expect(result).toEqual({ allowed: false, reason: 'ACTIVE_RESERVATION_EXISTS' });
  });

  it('rechaza crear una reserva si el usuario ya tiene una sesion activa', async () => {
    reservationsRepo.findActiveByUser.mockResolvedValue(null);
    sessionsRepo.findActiveByUser.mockResolvedValue({ id: 'session-1' } as never);
    const result = await policy.canCreateReservation('user-1');
    expect(result).toEqual({ allowed: false, reason: 'ACTIVE_SESSION_EXISTS' });
  });

  it('permite crear una reserva si no hay reserva ni sesion activa', async () => {
    reservationsRepo.findActiveByUser.mockResolvedValue(null);
    sessionsRepo.findActiveByUser.mockResolvedValue(null);
    const result = await policy.canCreateReservation('user-1');
    expect(result).toEqual({ allowed: true });
  });
});
