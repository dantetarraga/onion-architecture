import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { ParkingSessionRepositoryPort } from '../../../ports/out/parking-session.repository.port';
import { PARKING_SESSION_REPOSITORY } from '../../../ports/out/tokens';
import type { QrCodePort } from '../../../ports/out/qr-code.port';
import { QR_CODE } from '../../../ports/out/tokens';
import type { GenerateExitQrPort } from '../../../ports/in/parking/generate-exit-qr.port';

export interface GenerateExitQrInput {
  sessionId: string;
  userId: string;
}

@Injectable()
export class GenerateExitQrUseCase implements GenerateExitQrPort {
  constructor(
    @Inject(PARKING_SESSION_REPOSITORY)
    private readonly sessions: ParkingSessionRepositoryPort,
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
