import { ConfigService } from '@nestjs/config';
import { AesGcmSecretCipherAdapter } from './aes-gcm-secret-cipher.adapter';

function buildAdapter(env: Record<string, string>): AesGcmSecretCipherAdapter {
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  return new AesGcmSecretCipherAdapter(config);
}

describe('AesGcmSecretCipherAdapter', () => {
  it('descifra lo que cifro', () => {
    const cipher = buildAdapter({ MFA_ENCRYPTION_KEY: 'clave-de-prueba' });

    expect(cipher.decrypt(cipher.encrypt('JBSWY3DPEHPK3PXP'))).toBe(
      'JBSWY3DPEHPK3PXP',
    );
  });

  it('usa un IV distinto por valor: el mismo texto nunca produce el mismo cifrado', () => {
    const cipher = buildAdapter({ MFA_ENCRYPTION_KEY: 'clave-de-prueba' });

    expect(cipher.encrypt('secreto')).not.toBe(cipher.encrypt('secreto'));
  });

  it('falla al descifrar con otra clave o con el texto manipulado', () => {
    const original = buildAdapter({ MFA_ENCRYPTION_KEY: 'clave-A' });
    const other = buildAdapter({ MFA_ENCRYPTION_KEY: 'clave-B' });
    const encrypted = original.encrypt('secreto');

    expect(() => other.decrypt(encrypted)).toThrow();
    const [iv, body, tag] = encrypted.split('.');
    const tampered = [
      iv,
      Buffer.from('xx' + body.slice(2), 'base64').toString('base64'),
      tag,
    ].join('.');
    expect(() => original.decrypt(tampered)).toThrow();
  });

  it('cae a JWT_SECRET si no hay MFA_ENCRYPTION_KEY', () => {
    const cipher = buildAdapter({ JWT_SECRET: 'jwt' });

    expect(cipher.decrypt(cipher.encrypt('x'))).toBe('x');
  });
});
