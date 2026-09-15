import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { SecretCipherPort } from '../../../core/ports/out/secret-cipher.port';

/**
 * AES-256-GCM con IV aleatorio por valor. Formato guardado: `iv.cipher.tag`
 * en base64, autocontenido para poder rotar el algoritmo mas adelante.
 *
 * La clave se deriva con SHA-256 de MFA_ENCRYPTION_KEY (o, si falta, de
 * JWT_SECRET) para aceptar cualquier string y obtener siempre 32 bytes. En
 * produccion conviene una clave propia (`openssl rand -base64 32`): si se
 * cambia, los secretos ya guardados dejan de poder descifrarse y los usuarios
 * tendran que volver a configurar la app.
 */
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

@Injectable()
export class AesGcmSecretCipherAdapter implements SecretCipherPort {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const material =
      config.get<string>('MFA_ENCRYPTION_KEY') ??
      config.get<string>('JWT_SECRET') ??
      'dev-secret';
    this.key = createHash('sha256').update(material).digest();
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    return [iv, encrypted, cipher.getAuthTag()]
      .map((part) => part.toString('base64'))
      .join('.');
  }

  decrypt(cipherText: string): string {
    const [iv, encrypted, tag] = cipherText
      .split('.')
      .map((part) => Buffer.from(part, 'base64'));
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }
}
