import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Role } from '../../../domain/enums/role.enum';
import type { LoginWithFacebookPort } from '../../../ports/in/auth/login-with-facebook.port';
import type { FacebookTokenVerifierPort } from '../../../ports/out/facebook-token-verifier.port';
import type { PasswordHasherPort } from '../../../ports/out/password-hasher.port';
import type { TokenPort } from '../../../ports/out/token.port';
import {
  FACEBOOK_TOKEN_VERIFIER,
  PASSWORD_HASHER,
  TOKEN_SERVICE,
  USER_REPOSITORY,
} from '../../../ports/out/tokens';
import type { UserRepositoryPort } from '../../../ports/out/user.repository.port';
import type { LoginUserResult } from './login-user.use-case';

export interface LoginWithFacebookInput {
  accessToken: string;
}

@Injectable()
export class LoginWithFacebookUseCase implements LoginWithFacebookPort {
  constructor(
    @Inject(FACEBOOK_TOKEN_VERIFIER)
    private readonly facebookVerifier: FacebookTokenVerifierPort,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenPort,
  ) {}

  async execute(input: LoginWithFacebookInput): Promise<LoginUserResult> {
    const identity = await this.facebookVerifier.verify(input.accessToken);

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
