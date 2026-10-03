import { User } from '../../../domain/entities/user.entity';
import { Role } from '../../../domain/enums/role.enum';
import { InvalidCredentialsError } from '../../../domain/errors/invalid-credentials.error';
import { InvalidMfaCodeError } from '../../../domain/errors/invalid-mfa-code.error';
import type { PasswordHasherPort } from '../../../ports/out/password-hasher.port';
import type { SecretCipherPort } from '../../../ports/out/secret-cipher.port';
import type { TokenPort } from '../../../ports/out/token.port';
import type { TotpPort } from '../../../ports/out/totp.port';
import type {
  MfaCredentials,
  UserRepositoryPort,
} from '../../../ports/out/user.repository.port';
import { VerifyMfaUseCase } from './verify-mfa.use-case';

const user = new User({
  id: 'user-1',
  email: 'ana@parking.com',
  passwordHash: 'hash',
  fullName: 'Ana',
  role: Role.USER,
  mfaEnabled: true,
  createdAt: new Date(),
});

function build(credentials: Partial<MfaCredentials> = {}) {
  const users: jest.Mocked<UserRepositoryPort> = {
    findById: jest.fn().mockResolvedValue(user),
    findByEmail: jest.fn(),
    create: jest.fn(),
    findMfaCredentials: jest.fn().mockResolvedValue({
      enabled: true,
      totpSecretEnc: 'enc:SECRET',
      lastStep: 100,
      backupCodeHashes: ['hash-of-AAAA-BBBB'],
      ...credentials,
    }),
    updateMfa: jest.fn().mockResolvedValue(undefined),
  };
  const totp: jest.Mocked<TotpPort> = {
    generateSecret: jest.fn(),
    buildOtpAuthUri: jest.fn(),
    verify: jest.fn().mockReturnValue(null),
  };
  const cipher: SecretCipherPort = {
    encrypt: (v) => `enc:${v}`,
    decrypt: (v) => v.replace('enc:', ''),
  };
  const hasher: jest.Mocked<PasswordHasherPort> = {
    hash: jest.fn(),
    compare: jest
      .fn()
      .mockImplementation((plain: string, hash: string) =>
        Promise.resolve(hash === `hash-of-${plain}`),
      ),
  };
  const tokens: jest.Mocked<TokenPort> = {
    sign: jest.fn().mockResolvedValue('access-token'),
    verify: jest.fn(),
    signMfaChallenge: jest.fn(),
    verifyMfaChallenge: jest.fn().mockResolvedValue({ sub: 'user-1' }),
  };

  return {
    users,
    totp,
    hasher,
    tokens,
    useCase: new VerifyMfaUseCase(users, totp, cipher, hasher, tokens),
  };
}

describe('VerifyMfaUseCase', () => {
  it('emite el access token con un codigo TOTP valido y guarda el step usado', async () => {
    const { useCase, totp, users } = build();
    totp.verify.mockReturnValue(101);

    const result = await useCase.execute({
      mfaToken: 'challenge',
      code: '123456',
    });

    expect(result).toEqual({
      mfaRequired: false,
      accessToken: 'access-token',
      user: {
        id: 'user-1',
        email: 'ana@parking.com',
        fullName: 'Ana',
        role: Role.USER,
      },
    });
    expect(totp.verify).toHaveBeenCalledWith('SECRET', '123456');
    expect(users.updateMfa).toHaveBeenCalledWith('user-1', { lastStep: 101 });
  });

  it('rechaza un codigo TOTP incorrecto', async () => {
    const { useCase } = build();

    await expect(
      useCase.execute({ mfaToken: 'challenge', code: '000000' }),
    ).rejects.toBeInstanceOf(InvalidMfaCodeError);
  });

  it('rechaza reutilizar un codigo del mismo step (anti-replay)', async () => {
    const { useCase, totp, users } = build({ lastStep: 101 });
    totp.verify.mockReturnValue(101);

    await expect(
      useCase.execute({ mfaToken: 'challenge', code: '123456' }),
    ).rejects.toBeInstanceOf(InvalidMfaCodeError);
    expect(users.updateMfa).not.toHaveBeenCalled();
  });

  it('acepta un codigo de respaldo una sola vez y lo consume', async () => {
    const { useCase, users, totp } = build();

    const result = await useCase.execute({
      mfaToken: 'challenge',
      code: 'aaaa bbbb',
    });

    expect(result.mfaRequired).toBe(false);
    expect(totp.verify).not.toHaveBeenCalled();
    expect(users.updateMfa).toHaveBeenCalledWith('user-1', {
      backupCodeHashes: [],
    });
  });

  it('rechaza un codigo de respaldo que no existe', async () => {
    const { useCase } = build();

    await expect(
      useCase.execute({ mfaToken: 'challenge', code: 'ZZZZ-ZZZZ' }),
    ).rejects.toBeInstanceOf(InvalidMfaCodeError);
  });

  it('rechaza un mfaToken invalido o expirado', async () => {
    const { useCase, tokens } = build();
    tokens.verifyMfaChallenge.mockRejectedValue(new Error('exp'));

    await expect(
      useCase.execute({ mfaToken: 'viejo', code: '123456' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('rechaza si el usuario ya no tiene MFA activo', async () => {
    const { useCase } = build({ enabled: false });

    await expect(
      useCase.execute({ mfaToken: 'challenge', code: '123456' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
