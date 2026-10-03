import type { User } from '../../../domain/entities/user.entity';

export interface GetCurrentUserPort {
  execute(userId: string): Promise<User>;
}
