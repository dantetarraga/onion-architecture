import { Branch } from '../../../domain/entities/branch.entity';
import { Reservation } from '../../../domain/entities/reservation.entity';
import { ReservationStatus } from '../../../domain/enums/reservation-status.enum';
import { SlotType } from '../../../domain/enums/slot-type.enum';
import { NoAvailabilityError } from '../../../domain/errors/no-availability.error';
import { ReservationAlreadyActiveError } from '../../../domain/errors/reservation-already-active.error';
import type { CreateReservationPort } from '../../../ports/in/reservations/create-reservation.port';
import type { RealtimeNotifierPort } from '../../../ports/out/realtime-notifier.port';
import type { ReservationRequestMessage } from '../../../ports/out/reservation-request-queue.port';
import { ProcessReservationRequestUseCase } from './process-reservation-request.use-case';

const startAt = new Date('2026-08-21T10:00:00.000Z');
const expiresAt = new Date('2026-08-21T10:20:00.000Z');

const message: ReservationRequestMessage = {
  requestId: 'req-1',
  userId: 'user-1',
  branchId: 'branch-A',
  slotType: SlotType.REGULAR,
  startAt: undefined,
  requestedAt: startAt,
};

function buildReservation(): Reservation {
  return new Reservation({
    id: 'res-1',
    userId: 'user-1',
    branchId: 'branch-A',
    slotId: 'slot-1',
    requestedType: SlotType.REGULAR,
    status: ReservationStatus.PENDING,
    createdAt: startAt,
    startAt,
    expiresAt,
    confirmedAt: null,
  });
}

function build() {
  const createReservation: jest.Mocked<CreateReservationPort> = {
    execute: jest.fn(),
  };
  const notifier = {
    notifyReservationRequestResolved: jest.fn(),
  } as unknown as jest.Mocked<RealtimeNotifierPort>;

  return {
    createReservation,
    notifier,
    useCase: new ProcessReservationRequestUseCase(createReservation, notifier),
  };
}

describe('ProcessReservationRequestUseCase', () => {
  it('notifica CREATED con la cochera asignada cuando la reserva se crea', async () => {
    const { createReservation, notifier, useCase } = build();
    createReservation.execute.mockResolvedValue({
      outcome: 'CREATED',
      reservation: buildReservation(),
    });

    await useCase.execute(message);

    expect(createReservation.execute).toHaveBeenCalledWith({
      userId: 'user-1',
      branchId: 'branch-A',
      slotType: SlotType.REGULAR,
      startAt: undefined,
    });
    expect(notifier.notifyReservationRequestResolved).toHaveBeenCalledWith({
      requestId: 'req-1',
      userId: 'user-1',
      status: 'CREATED',
      reservation: {
        id: 'res-1',
        branchId: 'branch-A',
        slotId: 'slot-1',
        startAt,
        expiresAt,
      },
    });
  });

  it('notifica SUGGEST_OTHER_BRANCH con la sucursal alternativa y la distancia', async () => {
    const { createReservation, notifier, useCase } = build();
    createReservation.execute.mockResolvedValue({
      outcome: 'SUGGEST_OTHER_BRANCH',
      suggestedBranch: new Branch({
        id: 'branch-B',
        name: 'Sucursal B',
        address: 'Direccion B',
        lat: 0,
        lng: 0.01,
        pricePerHour: 5,
        createdAt: startAt,
      }),
      distanceKm: 1.2,
    });

    await useCase.execute(message);

    expect(notifier.notifyReservationRequestResolved).toHaveBeenCalledWith({
      requestId: 'req-1',
      userId: 'user-1',
      status: 'SUGGEST_OTHER_BRANCH',
      suggestedBranch: {
        id: 'branch-B',
        name: 'Sucursal B',
        address: 'Direccion B',
      },
      distanceKm: 1.2,
    });
  });

  it.each([
    ['RESERVATION_ALREADY_ACTIVE', new ReservationAlreadyActiveError()],
    ['NO_AVAILABILITY', new NoAvailabilityError()],
  ])(
    'notifica REJECTED sin relanzar cuando el nucleo rechaza por %s',
    async (code, error) => {
      const { createReservation, notifier, useCase } = build();
      createReservation.execute.mockRejectedValue(error);

      await expect(useCase.execute(message)).resolves.toBeUndefined();

      expect(notifier.notifyReservationRequestResolved).toHaveBeenCalledWith({
        requestId: 'req-1',
        userId: 'user-1',
        status: 'REJECTED',
        code,
        message: error.message,
      });
    },
  );

  it('relanza los errores de infraestructura para que el mensaje termine en la DLQ', async () => {
    const { createReservation, notifier, useCase } = build();
    createReservation.execute.mockRejectedValue(new Error('conexion a la base perdida'));

    await expect(useCase.execute(message)).rejects.toThrow('conexion a la base perdida');
    expect(notifier.notifyReservationRequestResolved).not.toHaveBeenCalled();
  });
});
