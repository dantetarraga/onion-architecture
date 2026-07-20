import { Inject, Injectable } from '@nestjs/common';
import { InvalidCredentialsError } from '../../../domain/errors/invalid-credentials.error';
import { USER_REPOSITORY } from '../../../domain/ports/tokens';
import type { UserRepositoryPort } from '../../../domain/ports/user.repository.port';
import type { PasswordHasherPort } from '../../ports/password-hasher.port';
import type { TokenPort } from '../../ports/token.port';
import { PASSWORD_HASHER, TOKEN_SERVICE } from '../../ports/tokens';

export interface LoginUserInput {
  email: string;
  password: string;
}

export interface LoginUserResult {
  accessToken: string;
  user: { id: string; email: string; fullName: string; role: string };
}

@Injectable()
export class LoginUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenPort,
  ) {}

  async execute(input: LoginUserInput): Promise<LoginUserResult> {
    const user = await this.users.findByEmail(input.email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await this.passwordHasher.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    const accessToken = await this.tokenService.sign({ sub: user.id, email: user.email, role: user.role });

    return {
      accessToken,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    };
  }
}
