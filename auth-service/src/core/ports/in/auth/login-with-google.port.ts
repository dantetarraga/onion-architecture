import type { LoginUserResult } from '../../../application/use-cases/auth/login-user.use-case';
import type { LoginWithGoogleInput } from '../../../application/use-cases/auth/login-with-google.use-case';

export interface LoginWithGooglePort {
  execute(input: LoginWithGoogleInput): Promise<LoginUserResult>;
}
