import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Role } from '../../../domain/enums/role.enum';
import { InvalidCredentialsError } from '../../../domain/errors/invalid-credentials.error';
import type { GoogleTokenVerifierPort } from '../../../ports/out/google-token-verifier.port';
import type { PasswordHasherPort } from '../../../ports/out/password-hasher.port';
import type { TokenPort } from '../../../ports/out/token.port';
import type { UserRepositoryPort } from '../../../ports/out/user.repository.port';
import {
  GOOGLE_TOKEN_VERIFIER,
  PASSWORD_HASHER,
  TOKEN_SERVICE,
  USER_REPOSITORY,
} from '../../../ports/out/tokens';
import type { LoginWithGooglePort } from '../../../ports/in/auth/login-with-google.port';
import type { LoginUserResult } from './login-user.use-case';

export interface LoginWithGoogleInput {
  idToken: string;
}

/**
 * Login/registro con Google (Firebase Authentication). Reusa el mismo
 * TokenPort del login por password: el resto de la app (JwtAuthGuard,
 * demas casos de uso) no distingue como se autentico el usuario, solo ve
 * el mismo accessToken de siempre.
 *
 * Cuenta nueva: se crea con un passwordHash aleatorio e inutilizable (no hay
 * password que el usuario conozca), asi que LoginUserUseCase la rechaza
 * naturalmente por credenciales invalidas sin necesitar tocar ese caso de
 * uso, el repositorio ni el schema (passwordHash sigue siendo NOT NULL).
 * Cuenta existente con el mismo email: se vincula por email (Google ya lo
 * verifica), coherente con Politica de unicidad de email del sistema.
 */
@Injectable()
export class LoginWithGoogleUseCase implements LoginWithGooglePort {
  constructor(
    @Inject(GOOGLE_TOKEN_VERIFIER)
    private readonly googleVerifier: GoogleTokenVerifierPort,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenPort,
  ) {}

  async execute(input: LoginWithGoogleInput): Promise<LoginUserResult> {
    const identity = await this.googleVerifier.verify(input.idToken);
    if (!identity.emailVerified) {
      throw new InvalidCredentialsError('El correo de Google no esta verificado.');
    }

    let user = await this.users.findByEmail(identity.email);
    if (!user) {
      const unusablePassword = await this.passwordHasher.hash(randomUUID());
      user = await this.users.create({
        email: identity.email,
        passwordHash: unusablePassword,
        fullName: identity.fullName,
        role: Role.USER,
      });
    }

    const accessToken = await this.tokenService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }
}
