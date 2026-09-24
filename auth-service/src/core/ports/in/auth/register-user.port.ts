import type { User } from '../../../domain/entities/user.entity';
import type { RegisterUserInput } from '../../../application/use-cases/auth/register-user.use-case';

export interface RegisterUserPort {
  execute(input: RegisterUserInput): Promise<User>;
}
