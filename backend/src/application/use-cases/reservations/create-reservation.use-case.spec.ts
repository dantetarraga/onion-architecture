import { Branch, BranchProps } from '../../../domain/entities/branch.entity';
import { ParkingSlot, ParkingSlotProps } from '../../../domain/entities/parking-slot.entity';
import { Reservation, ReservationProps } from '../../../domain/entities/reservation.entity';
import { ReservationStatus } from '../../../domain/enums/reservation-status.enum';
import { SlotStatus } from '../../../domain/enums/slot-status.enum';
import { SlotType } from '../../../domain/enums/slot-type.enum';
import { NoAvailabilityError } from '../../../domain/errors/no-availability.error';
import type { ReservationPolicy } from '../../../domain/policies/reservation.policy';
import type { SlotAssignmentPolicy } from '../../../domain/policies/slot-assignment.policy';
import type { ReservationRepositoryPort } from '../../../domain/ports/reservation.repository.port';
import type { ClockPort } from '../../ports/clock.port';
import type { RealtimeNotifierPort } from '../../ports/realtime-notifier.port';
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

function buildReservation(overrides: Partial<ReservationProps> = {}): Reservation {
  return new Reservation({
    id: 'reservation-1',
    userId: 'user-1',
    branchId: 'branch-C',
    slotId: 'slot-1',
    requestedType: SlotType.REGULAR,
    status: ReservationStatus.PENDING,
    createdAt: new Date(),
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
  };

  let useCase: CreateReservationUseCase;
  const now = new Date('2026-07-22T12:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    clock.now.mockReturnValue(now);
    reservationPolicy.canCreateReservation.mockResolvedValue({ allowed: true });
    reservationPolicy.calculateExpiresAt.mockReturnValue(new Date(now.getTime() + 15 * 60 * 1000));
    useCase = new CreateReservationUseCase(reservationsRepo, reservationPolicy, slotAssignmentPolicy, clock, notifier);
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

    const confirmResult = await useCase.execute({ userId: 'user-1', branchId: 'branch-B' });

    expect(slotAssignmentPolicy.assign).toHaveBeenCalledWith({ branchId: 'branch-B', slotType: undefined });
    expect(confirmResult.outcome).toBe('SUGGEST_OTHER_BRANCH');
    if (confirmResult.outcome === 'SUGGEST_OTHER_BRANCH') {
      expect(confirmResult.suggestedBranch.id).toBe('branch-C');
    }
    expect(reservationsRepo.create).not.toHaveBeenCalled();
  });

  it('al confirmar la sucursal sugerida B con cupo, crea la reserva ahi mismo', async () => {
    const slot = buildSlot({ branchId: 'branch-B' });
    slotAssignmentPolicy.assign.mockResolvedValueOnce({ outcome: 'ASSIGNED', slot });
    reservationsRepo.create.mockResolvedValue(buildReservation({ branchId: 'branch-B', slotId: slot.id }));

    const result = await useCase.execute({ userId: 'user-1', branchId: 'branch-B' });

    expect(result.outcome).toBe('CREATED');
    expect(reservationsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'branch-B', slotId: slot.id }),
    );
  });

  it('lanza NoAvailabilityError si ninguna sucursal cercana tiene cupo', async () => {
    slotAssignmentPolicy.assign.mockResolvedValueOnce({ outcome: 'NO_AVAILABILITY' });

    await expect(useCase.execute({ userId: 'user-1', branchId: 'branch-B' })).rejects.toThrow(NoAvailabilityError);
    expect(reservationsRepo.create).not.toHaveBeenCalled();
  });
});
