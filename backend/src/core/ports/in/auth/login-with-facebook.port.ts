import type { LoginUserResult } from '../../../application/use-cases/auth/login-user.use-case';
import type { LoginWithFacebookInput } from '../../../application/use-cases/auth/login-with-facebook.use-case';

export interface LoginWithFacebookPort {
  execute(input: LoginWithFacebookInput): Promise<LoginUserResult>;
}
