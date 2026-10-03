import type {
  ConfirmMfaInput,
  ConfirmMfaResult,
} from '../../../application/use-cases/auth/confirm-mfa.use-case';

export interface ConfirmMfaPort {
  execute(input: ConfirmMfaInput): Promise<ConfirmMfaResult>;
}
