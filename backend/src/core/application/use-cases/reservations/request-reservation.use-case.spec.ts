import { SlotType } from '../../../domain/enums/slot-type.enum';
import { ReservationQueueUnavailableError } from '../../../domain/errors/reservation-queue-unavailable.error';
import type { ClockPort } from '../../../ports/out/clock.port';
import type { ReservationRequestQueuePort } from '../../../ports/out/reservation-request-queue.port';
import { RequestReservationUseCase } from './request-reservation.use-case';

describe('RequestReservationUseCase', () => {
  const now = new Date('2026-08-21T10:00:00.000Z');

  function build() {
    const queue: jest.Mocked<ReservationRequestQueuePort> = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    };
    const clock: ClockPort = { now: () => now };

    return { queue, useCase: new RequestReservationUseCase(queue, clock) };
  }

  it('encola la solicitud con los datos del usuario y devuelve el requestId', async () => {
    const { queue, useCase } = build();

    const result = await useCase.execute({
      userId: 'user-1',
      branchId: 'branch-A',
      slotType: SlotType.MOTO,
    });

    expect(result.status).toBe('QUEUED');
    expect(result.requestId).toEqual(expect.any(String));
    expect(queue.enqueue).toHaveBeenCalledWith({
      requestId: result.requestId,
      userId: 'user-1',
      branchId: 'branch-A',
      slotType: SlotType.MOTO,
      startAt: undefined,
      requestedAt: now,
    });
  });

  it('propaga la fecha de inicio de una reserva programada', async () => {
    const { queue, useCase } = build();
    const startAt = new Date('2026-08-22T15:00:00.000Z');

    await useCase.execute({ userId: 'user-1', branchId: 'branch-A', startAt });

    expect(queue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ startAt }),
    );
  });

  it('genera un requestId distinto por solicitud para poder correlacionar el resultado', async () => {
    const { useCase } = build();

    const first = await useCase.execute({ userId: 'user-1', branchId: 'branch-A' });
    const second = await useCase.execute({ userId: 'user-1', branchId: 'branch-A' });

    expect(first.requestId).not.toBe(second.requestId);
  });

  it('lanza RESERVATION_QUEUE_UNAVAILABLE si la cola rechaza el mensaje', async () => {
    const { queue, useCase } = build();
    queue.enqueue.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      useCase.execute({ userId: 'user-1', branchId: 'branch-A' }),
    ).rejects.toBeInstanceOf(ReservationQueueUnavailableError);
  });
});
