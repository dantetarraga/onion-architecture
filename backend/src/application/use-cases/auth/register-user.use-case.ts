import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../../domain/entities/user.entity';
import { Role } from '../../../domain/enums/role.enum';
import { EmailAlreadyRegisteredError } from '../../../domain/errors/email-already-registered.error';
import { USER_REPOSITORY } from '../../../domain/ports/tokens';
import type { UserRepositoryPort } from '../../../domain/ports/user.repository.port';
import type { PasswordHasherPort } from '../../ports/password-hasher.port';
import { PASSWORD_HASHER } from '../../ports/tokens';

export interface RegisterUserInput {
  email: string;
  password: string;
  fullName: string;
}

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(input: RegisterUserInput): Promise<User> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new EmailAlreadyRegisteredError();
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    return this.users.create({
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: Role.USER,
    });
  }
}
