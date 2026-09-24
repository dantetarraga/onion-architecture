import { User, UserProps } from '../../../domain/entities/user.entity';
import { Role } from '../../../domain/enums/role.enum';
import { InvalidCredentialsError } from '../../../domain/errors/invalid-credentials.error';
import type { PasswordHasherPort } from '../../../ports/out/password-hasher.port';
import type { TokenPort } from '../../../ports/out/token.port';
import type { UserRepositoryPort } from '../../../ports/out/user.repository.port';
import { LoginUserUseCase } from './login-user.use-case';

function buildUser(overrides: Partial<UserProps> = {}): User {
  return new User({
    id: 'user-1',
    email: 'ana@parking.com',
    passwordHash: 'hash',
    fullName: 'Ana',
    role: Role.USER,
    mfaEnabled: false,
    createdAt: new Date(),
    ...overrides,
  });
}

function build(user: User | null) {
  const users: jest.Mocked<UserRepositoryPort> = {
    findById: jest.fn(),
    findByEmail: jest.fn().mockResolvedValue(user),
    create: jest.fn(),
    findMfaCredentials: jest.fn(),
    updateMfa: jest.fn(),
  };
  const hasher: jest.Mocked<PasswordHasherPort> = {
    hash: jest.fn(),
    compare: jest.fn().mockResolvedValue(true),
  };
  const tokens: jest.Mocked<TokenPort> = {
    sign: jest.fn().mockResolvedValue('access-token'),
    verify: jest.fn(),
    signMfaChallenge: jest.fn().mockResolvedValue('mfa-token'),
    verifyMfaChallenge: jest.fn(),
  };
  return {
    users,
    hasher,
    tokens,
    useCase: new LoginUserUseCase(users, hasher, tokens),
  };
}

describe('LoginUserUseCase', () => {
  it('sin MFA: devuelve el access token y el usuario', async () => {
    const { useCase, tokens } = build(buildUser());

    const result = await useCase.execute({
      email: 'ana@parking.com',
      password: 'pw',
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
    expect(tokens.signMfaChallenge).not.toHaveBeenCalled();
  });

  it('con MFA: devuelve solo el desafio, nunca el access token', async () => {
    const { useCase, tokens } = build(buildUser({ mfaEnabled: true }));

    const result = await useCase.execute({
      email: 'ana@parking.com',
      password: 'pw',
    });

    expect(result).toEqual({ mfaRequired: true, mfaToken: 'mfa-token' });
    expect(tokens.signMfaChallenge).toHaveBeenCalledWith('user-1');
    expect(tokens.sign).not.toHaveBeenCalled();
  });

  it('rechaza password incorrecto sin emitir ningun token', async () => {
    const { useCase, hasher, tokens } = build(buildUser({ mfaEnabled: true }));
    hasher.compare.mockResolvedValue(false);

    await expect(
      useCase.execute({ email: 'ana@parking.com', password: 'x' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(tokens.signMfaChallenge).not.toHaveBeenCalled();
  });

  it('rechaza usuario inexistente', async () => {
    const { useCase } = build(null);

    await expect(
      useCase.execute({ email: 'nadie@parking.com', password: 'x' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
