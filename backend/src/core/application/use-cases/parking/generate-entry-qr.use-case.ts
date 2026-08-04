import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { ReservationRepositoryPort } from '../../../ports/out/reservation.repository.port';
import { RESERVATION_REPOSITORY } from '../../../ports/out/tokens';
import type { QrCodePort } from '../../../ports/out/qr-code.port';
import { QR_CODE } from '../../../ports/out/tokens';
import type { GenerateEntryQrPort } from '../../../ports/in/parking/generate-entry-qr.port';

export interface GenerateEntryQrInput {
  reservationId: string;
  userId: string;
}

@Injectable()
export class GenerateEntryQrUseCase implements GenerateEntryQrPort {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservations: ReservationRepositoryPort,
    @Inject(QR_CODE) private readonly qrCode: QrCodePort,
  ) {}

  async execute(input: GenerateEntryQrInput): Promise<{ qrPayload: string }> {
    const reservation = await this.reservations.findById(input.reservationId);
    if (!reservation || reservation.userId !== input.userId) {
      throw new NotFoundError('Reservation', input.reservationId);
    }

    return { qrPayload: this.qrCode.signEntryToken(reservation.id) };
  }
}
