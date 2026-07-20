import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { ParkingSessionRepositoryPort } from '../../../domain/ports/parking-session.repository.port';
import { PARKING_SESSION_REPOSITORY } from '../../../domain/ports/tokens';
import type { QrCodePort } from '../../ports/qr-code.port';
import { QR_CODE } from '../../ports/tokens';

export interface GenerateExitQrInput {
  sessionId: string;
  userId: string;
}

@Injectable()
export class GenerateExitQrUseCase {
  constructor(
    @Inject(PARKING_SESSION_REPOSITORY) private readonly sessions: ParkingSessionRepositoryPort,
    @Inject(QR_CODE) private readonly qrCode: QrCodePort,
  ) {}

  async execute(input: GenerateExitQrInput): Promise<{ qrPayload: string }> {
    const session = await this.sessions.findById(input.sessionId);
    if (!session || session.userId !== input.userId) {
      throw new NotFoundError('ParkingSession', input.sessionId);
    }

    return { qrPayload: this.qrCode.signExitToken(session.id) };
  }
}
