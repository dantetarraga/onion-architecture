import type {
  SetupMfaInput,
  SetupMfaResult,
} from '../../../application/use-cases/auth/setup-mfa.use-case';

export interface SetupMfaPort {
  execute(input: SetupMfaInput): Promise<SetupMfaResult>;
}
