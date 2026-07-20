import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { QrCodePort, QrPayload } from '../../application/ports/qr-code.port';
import { InvalidQrCodeError } from '../../domain/errors/invalid-qr-code.error';

const QR_TTL_MS = 15 * 60 * 1000;

/** QR firmado con HMAC-SHA256, independiente del JWT de autenticacion. */
@Injectable()
export class HmacQrCodeAdapter implements QrCodePort {
  private readonly secret: string;

  constructor(private readonly config: ConfigService) {
    this.secret = this.config.get<string>('JWT_SECRET') ?? 'dev-secret';
  }

  signEntryToken(reservationId: string): string {
    return this.encode({ type: 'ENTRY', reservationId, expiresAt: Date.now() + QR_TTL_MS });
  }

  signExitToken(sessionId: string): string {
    return this.encode({ type: 'EXIT', sessionId, expiresAt: Date.now() + QR_TTL_MS });
  }

  verify(token: string): QrPayload {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature || signature !== this.sign(encodedPayload)) {
      throw new InvalidQrCodeError();
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as QrPayload;
    if (payload.expiresAt < Date.now()) {
      throw new InvalidQrCodeError('El QR ha expirado.');
    }

    return payload;
  }

  private encode(payload: QrPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return `${encodedPayload}.${this.sign(encodedPayload)}`;
  }

  private sign(encodedPayload: string): string {
    return createHmac('sha256', this.secret).update(encodedPayload).digest('base64url');
  }
}
