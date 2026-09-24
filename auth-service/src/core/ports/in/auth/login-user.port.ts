import type {
  LoginUserInput,
  LoginUserResult,
} from '../../../application/use-cases/auth/login-user.use-case';

export interface LoginUserPort {
  execute(input: LoginUserInput): Promise<LoginUserResult>;
}
