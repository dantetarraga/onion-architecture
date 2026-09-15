import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ClockPort } from '../../../core/ports/out/clock.port';
import { CLOCK } from '../../../core/ports/out/tokens';
import { TotpPort } from '../../../core/ports/out/totp.port';

/**
 * TOTP (RFC 6238) sobre HOTP (RFC 4226) implementado con node:crypto, sin
 * dependencias. Son ~40 lineas y es exactamente lo que corre Google
 * Authenticator del otro lado:
 *
 *   step  = floor(unixSeconds / 30)
 *   hmac  = HMAC-SHA1(secret, step como entero big-endian de 8 bytes)
 *   off   = ultimo nibble del hmac
 *   code  = (hmac[off..off+4] & 0x7fffffff) mod 10^6, con ceros a la izquierda
 *
 * Parametros fijos por compatibilidad con las apps (SHA1, 6 digitos, 30 s).
 */
const STEP_SECONDS = 30;
const DIGITS = 6;
/** Tolerancia de +-1 step (30 s) por desfase de reloj entre servidor y celular. */
const WINDOW = 1;
const SECRET_BYTES = 20;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

@Injectable()
export class Rfc6238TotpAdapter implements TotpPort {
  /** Recibe el reloj por puerto (igual que los casos de uso) para poder testear contra los vectores de la RFC. */
  constructor(@Inject(CLOCK) private readonly clock: ClockPort) {}

  generateSecret(): string {
    return base32Encode(randomBytes(SECRET_BYTES));
  }

  buildOtpAuthUri(params: {
    secret: string;
    accountName: string;
    issuer: string;
  }): string {
    const label = encodeURIComponent(`${params.issuer}:${params.accountName}`);
    const query = new URLSearchParams({
      secret: params.secret,
      issuer: params.issuer,
      algorithm: 'SHA1',
      digits: String(DIGITS),
      period: String(STEP_SECONDS),
    });
    return `otpauth://totp/${label}?${query.toString()}`;
  }

  verify(secret: string, code: string): number | null {
    if (!/^\d{6}$/.test(code)) return null;

    const key = base32Decode(secret);
    const currentStep = Math.floor(
      this.clock.now().getTime() / 1000 / STEP_SECONDS,
    );
    const given = Buffer.from(code);

    for (let delta = -WINDOW; delta <= WINDOW; delta += 1) {
      const step = currentStep + delta;
      const expected = Buffer.from(hotp(key, step));
      if (timingSafeEqual(expected, given)) return step;
    }
    return null;
  }
}

export function hotp(key: Buffer, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input
    .toUpperCase()
    .replace(/=+$/, '')
    .replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    value = ((value << 5) | BASE32_ALPHABET.indexOf(char)) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
