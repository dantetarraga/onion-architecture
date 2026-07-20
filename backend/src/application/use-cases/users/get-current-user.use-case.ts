import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../../domain/entities/user.entity';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import { USER_REPOSITORY } from '../../../domain/ports/tokens';
import type { UserRepositoryPort } from '../../../domain/ports/user.repository.port';

@Injectable()
export class GetCurrentUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort) {}

  async execute(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }
    return user;
  }
}
