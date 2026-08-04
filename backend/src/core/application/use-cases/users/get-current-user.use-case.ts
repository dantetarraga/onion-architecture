import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../../domain/entities/user.entity';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import { USER_REPOSITORY } from '../../../ports/out/tokens';
import type { UserRepositoryPort } from '../../../ports/out/user.repository.port';
import type { GetCurrentUserPort } from '../../../ports/in/users/get-current-user.port';

@Injectable()
export class GetCurrentUserUseCase implements GetCurrentUserPort {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
  ) {}

  async execute(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }
    return user;
  }
}
