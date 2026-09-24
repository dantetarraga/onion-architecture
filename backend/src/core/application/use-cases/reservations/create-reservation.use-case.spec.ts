import { Branch, BranchProps } from '../../../domain/entities/branch.entity';
import {
  ParkingSlot,
  ParkingSlotProps,
} from '../../../domain/entities/parking-slot.entity';
import {
  Reservation,
  ReservationProps,
} from '../../../domain/entities/reservation.entity';
import { ReservationStatus } from '../../../domain/enums/reservation-status.enum';
import { SlotStatus } from '../../../domain/enums/slot-status.enum';
import { SlotType } from '../../../domain/enums/slot-type.enum';
import { NoAvailabilityError } from '../../../domain/errors/no-availability.error';
import type { ReservationPolicy } from '../../../domain/policies/reservation.policy';
import type { SlotAssignmentPolicy } from '../../../domain/policies/slot-assignment.policy';
import type { BranchRepositoryPort } from '../../../ports/out/branch.repository.port';
import type { ReservationRepositoryPort } from '../../../ports/out/reservation.repository.port';
import type {
  UserLookupPort,
  UserLookupResult,
} from '../../../ports/out/user-lookup.port';
import type { ClockPort } from '../../../ports/out/clock.port';
import type { NotificationPublisherPort } from '../../../ports/out/notification-publisher.port';
import type { RealtimeNotifierPort } from '../../../ports/out/realtime-notifier.port';
import { CreateReservationUseCase } from './create-reservation.use-case';

function buildBranch(overrides: Partial<BranchProps> = {}): Branch {
  return new Branch({
    id: 'branch-B',
    name: 'Sucursal B',
    address: 'Direccion B',
    lat: 0,
    lng: 0.01,
    pricePerHour: 5,
    createdAt: new Date(),
    ...overrides,
  });
}

function buildUser(overrides: Partial<UserLookupResult> = {}): UserLookupResult {
  return {
    id: 'user-1',
    email: 'user@parking.com',
    fullName: 'Usuario de Prueba',
    ...overrides,
  };
}

function buildSlot(overrides: Partial<ParkingSlotProps> = {}): ParkingSlot {
  return new ParkingSlot({
    id: 'slot-1',
    branchId: 'branch-A',
    code: 'REG-01',
    type: SlotType.REGULAR,
    status: SlotStatus.RESERVADA,
    updatedAt: new Date(),
    ...overrides,
  });
}

function buildReservation(
  overrides: Partial<ReservationProps> = {},
): Reservation {
  return new Reservation({
    id: 'reservation-1',
    userId: 'user-1',
    branchId: 'branch-C',
    slotId: 'slot-1',
    requestedType: SlotType.REGULAR,
    status: ReservationStatus.PENDING,
    createdAt: new Date(),
    startAt: new Date(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    confirmedAt: null,
    ...overrides,
  });
}

describe('CreateReservationUseCase', () => {
  const reservationsRepo: jest.Mocked<ReservationRepositoryPort> = {
    findById: jest.fn(),
    findActiveByUser: jest.fn(),
    findExpiredPending: jest.fn(),
    create: jest.fn(),
    updateStatus: jest.fn(),
    listByUser: jest.fn(),
    listByFilters: jest.fn(),
  };
  const reservationPolicy: jest.Mocked<ReservationPolicy> = {
    canCreateReservation: jest.fn(),
    getToleranceWindowMinutes: jest.fn(),
    isExpired: jest.fn(),
    calculateExpiresAt: jest.fn(),
  };
  const slotAssignmentPolicy: jest.Mocked<SlotAssignmentPolicy> = {
    assign: jest.fn(),
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
    notifyReservationRequestResolved: jest.fn(),
  };
  const usersRepo: jest.Mocked<UserLookupPort> = {
    findById: jest.fn(),
  };
  const branchesRepo: jest.Mocked<BranchRepositoryPort> = {
    findById: jest.fn(),
    findAll: jest.fn(),
    findByIds: jest.fn(),
    findAllExcept: jest.fn(),
  };
  const notifications: jest.Mocked<NotificationPublisherPort> = {
    publishReservationConfirmation: jest.fn(),
  };

  let useCase: CreateReservationUseCase;
  const now = new Date('2026-07-22T12:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    clock.now.mockReturnValue(now);
    reservationPolicy.canCreateReservation.mockResolvedValue({ allowed: true });
    reservationPolicy.calculateExpiresAt.mockReturnValue(
      new Date(now.getTime() + 15 * 60 * 1000),
    );
    usersRepo.findById.mockResolvedValue(buildUser());
    branchesRepo.findById.mockResolvedValue(buildBranch());
    useCase = new CreateReservationUseCase(
      reservationsRepo,
      reservationPolicy,
      slotAssignmentPolicy,
      clock,
      notifier,
      usersRepo,
      branchesRepo,
      notifications,
    );
  });

  /**
   * E4: `POST /reservations/confirm-suggestion` reusa este mismo caso de uso con la
   * sucursal sugerida como nuevo branchId. Si esa sucursal tambien se llena mientras
   * el usuario decidia, debe revalidar en cascada: A llena -> sugiere B -> B tambien
   * llena -> sugiere C. Esto ya funciona por reuso de codigo (SlotAssignmentPolicy.assign
   * se ejecuta completo de nuevo); este test documenta el comportamiento para que no se
   * rompa sin querer.
   */
  it('al confirmar la sucursal sugerida B, si B tambien se lleno revalida y sugiere C en cascada', async () => {
    slotAssignmentPolicy.assign.mockResolvedValueOnce({
      outcome: 'SUGGEST_OTHER_BRANCH',
      suggestedBranch: buildBranch({ id: 'branch-C', name: 'Sucursal C' }),
      distanceKm: 2.4,
    });

    const confirmResult = await useCase.execute({
      userId: 'user-1',
      branchId: 'branch-B',
    });

    expect(slotAssignmentPolicy.assign).toHaveBeenCalledWith({
      branchId: 'branch-B',
      slotType: undefined,
    });
    expect(confirmResult.outcome).toBe('SUGGEST_OTHER_BRANCH');
    if (confirmResult.outcome === 'SUGGEST_OTHER_BRANCH') {
      expect(confirmResult.suggestedBranch.id).toBe('branch-C');
    }
    expect(reservationsRepo.create).not.toHaveBeenCalled();
  });

  it('al confirmar la sucursal sugerida B con cupo, crea la reserva ahi mismo', async () => {
    const slot = buildSlot({ branchId: 'branch-B' });
    slotAssignmentPolicy.assign.mockResolvedValueOnce({
      outcome: 'ASSIGNED',
      slot,
    });
    reservationsRepo.create.mockResolvedValue(
      buildReservation({ branchId: 'branch-B', slotId: slot.id }),
    );

    const result = await useCase.execute({
      userId: 'user-1',
      branchId: 'branch-B',
    });

    expect(result.outcome).toBe('CREATED');
    expect(reservationsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'branch-B', slotId: slot.id }),
    );
  });

  it('usa la fecha y hora de inicio seleccionada para calcular la ventana de reserva', async () => {
    const slot = buildSlot({ branchId: 'branch-B' });
    const scheduledStart = new Date('2026-07-22T13:30:00.000Z');
    slotAssignmentPolicy.assign.mockResolvedValueOnce({
      outcome: 'ASSIGNED',
      slot,
    });
    reservationsRepo.create.mockResolvedValue(
      buildReservation({ branchId: 'branch-B', slotId: slot.id }),
    );

    await useCase.execute({
      userId: 'user-1',
      branchId: 'branch-B',
      startAt: scheduledStart,
    });

    expect(reservationPolicy.calculateExpiresAt).toHaveBeenCalledWith(
      scheduledStart,
    );
    expect(reservationsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'branch-B',
        slotId: slot.id,
        startAt: scheduledStart,
      }),
    );
  });

  it('al crear reserva inmediata usa ahora como startAt', async () => {
    const slot = buildSlot({ branchId: 'branch-B' });
    const now = new Date('2026-07-22T12:00:00.000Z');
    clock.now.mockReturnValue(now);
    slotAssignmentPolicy.assign.mockResolvedValueOnce({
      outcome: 'ASSIGNED',
      slot,
    });
    reservationsRepo.create.mockResolvedValue(
      buildReservation({ branchId: 'branch-B', slotId: slot.id, startAt: now }),
    );

    await useCase.execute({ userId: 'user-1', branchId: 'branch-B' });

    expect(reservationsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'branch-B',
        slotId: slot.id,
        startAt: now,
      }),
    );
  });

  it('publica el evento de confirmacion en la cola de notificaciones al crear la reserva', async () => {
    const slot = buildSlot({ branchId: 'branch-B' });
    const reservation = buildReservation({
      branchId: 'branch-B',
      slotId: slot.id,
    });
    slotAssignmentPolicy.assign.mockResolvedValueOnce({
      outcome: 'ASSIGNED',
      slot,
    });
    reservationsRepo.create.mockResolvedValue(reservation);
    usersRepo.findById.mockResolvedValue(
      buildUser({
        id: reservation.userId,
        email: 'demo@parking.com',
        fullName: 'Demo Usuario',
      }),
    );
    branchesRepo.findById.mockResolvedValue(
      buildBranch({
        id: 'branch-B',
        name: 'Sucursal B',
        address: 'Av. Siempre Viva 123',
      }),
    );

    await useCase.execute({ userId: reservation.userId, branchId: 'branch-B' });

    expect(usersRepo.findById).toHaveBeenCalledWith(reservation.userId);
    expect(branchesRepo.findById).toHaveBeenCalledWith('branch-B');
    expect(notifications.publishReservationConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'reservation.confirmation.email',
        reservationId: reservation.id,
        userId: reservation.userId,
        userEmail: 'demo@parking.com',
        userFullName: 'Demo Usuario',
        branchId: 'branch-B',
        branchName: 'Sucursal B',
        branchAddress: 'Av. Siempre Viva 123',
        slotId: slot.id,
      }),
    );
  });

  it('no publica el evento de confirmacion si el usuario o la sucursal ya no existen', async () => {
    const slot = buildSlot({ branchId: 'branch-B' });
    reservationsRepo.create.mockResolvedValue(
      buildReservation({ branchId: 'branch-B', slotId: slot.id }),
    );
    slotAssignmentPolicy.assign.mockResolvedValueOnce({
      outcome: 'ASSIGNED',
      slot,
    });
    usersRepo.findById.mockResolvedValue(null);

    await useCase.execute({ userId: 'user-1', branchId: 'branch-B' });

    expect(notifications.publishReservationConfirmation).not.toHaveBeenCalled();
  });

  it('lanza NoAvailabilityError si ninguna sucursal cercana tiene cupo', async () => {
    slotAssignmentPolicy.assign.mockResolvedValueOnce({
      outcome: 'NO_AVAILABILITY',
    });

    await expect(
      useCase.execute({ userId: 'user-1', branchId: 'branch-B' }),
    ).rejects.toThrow(NoAvailabilityError);
    expect(reservationsRepo.create).not.toHaveBeenCalled();
  });
});
