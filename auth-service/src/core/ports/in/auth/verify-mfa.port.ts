import type { LoginUserResult } from '../../../application/use-cases/auth/issue-session';
import type { VerifyMfaInput } from '../../../application/use-cases/auth/verify-mfa.use-case';

export interface VerifyMfaPort {
  execute(input: VerifyMfaInput): Promise<LoginUserResult>;
}
