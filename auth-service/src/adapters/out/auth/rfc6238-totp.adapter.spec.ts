import type { ClockPort } from '../../../core/ports/out/clock.port';
import {
  base32Decode,
  base32Encode,
  hotp,
  Rfc6238TotpAdapter,
} from './rfc6238-totp.adapter';

function clockAt(unixSeconds: number): ClockPort {
  return { now: () => new Date(unixSeconds * 1000) };
}

/**
 * Vectores de prueba oficiales del Apendice B de la RFC 6238 (HMAC-SHA1,
 * secreto ASCII "12345678901234567890"). La RFC lista codigos de 8 digitos;
 * los de 6 son los mismos sin los dos primeros.
 */
const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii');
const RFC_VECTORS: Array<{ unixSeconds: number; code8: string }> = [
  { unixSeconds: 59, code8: '94287082' },
  { unixSeconds: 1111111109, code8: '07081804' },
  { unixSeconds: 1111111111, code8: '14050471' },
  { unixSeconds: 1234567890, code8: '89005924' },
  { unixSeconds: 2000000000, code8: '69279037' },
  { unixSeconds: 20000000000, code8: '65353130' },
];

describe('Rfc6238TotpAdapter', () => {
  const rfcSecretBase32 = base32Encode(RFC_SECRET);

  it.each(RFC_VECTORS)(
    'genera el codigo de la RFC 6238 para t=$unixSeconds',
    ({ unixSeconds, code8 }) => {
      const step = Math.floor(unixSeconds / 30);
      expect(hotp(RFC_SECRET, step)).toBe(code8.slice(2));
    },
  );

  it('acepta el codigo del step actual y devuelve ese step', () => {
    const adapter = new Rfc6238TotpAdapter(clockAt(1111111111));

    expect(adapter.verify(rfcSecretBase32, '050471')).toBe(
      Math.floor(1111111111 / 30),
    );
  });

  it('tolera +-1 step de desfase de reloj', () => {
    const adapter = new Rfc6238TotpAdapter(clockAt(1111111111));
    // t=1111111109 cae en el step anterior (37037036 vs 37037037).
    expect(adapter.verify(rfcSecretBase32, '081804')).toBe(
      Math.floor(1111111109 / 30),
    );
  });

  it('rechaza codigos de otro momento o mal formados', () => {
    const adapter = new Rfc6238TotpAdapter(clockAt(1111111111));

    expect(adapter.verify(rfcSecretBase32, '287082')).toBeNull(); // t=59
    expect(adapter.verify(rfcSecretBase32, '12345')).toBeNull();
    expect(adapter.verify(rfcSecretBase32, 'abcdef')).toBeNull();
  });

  it('base32 es reversible y genera secretos de 20 bytes distintos', () => {
    const adapter = new Rfc6238TotpAdapter(clockAt(0));
    const a = adapter.generateSecret();
    const b = adapter.generateSecret();

    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(a)).toHaveLength(20);
    expect(base32Decode(base32Encode(RFC_SECRET))).toEqual(RFC_SECRET);
  });

  it('arma la URI otpauth con el formato que esperan las apps', () => {
    const uri = new Rfc6238TotpAdapter(clockAt(0)).buildOtpAuthUri({
      secret: 'ABC234',
      accountName: 'ana@parking.com',
      issuer: 'Parking/OS',
    });

    expect(uri).toBe(
      'otpauth://totp/Parking%2FOS%3Aana%40parking.com?secret=ABC234&issuer=Parking%2FOS&algorithm=SHA1&digits=6&period=30',
    );
  });
});
