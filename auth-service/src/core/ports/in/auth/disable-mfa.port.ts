import type { DisableMfaInput } from '../../../application/use-cases/auth/disable-mfa.use-case';

export interface DisableMfaPort {
  execute(input: DisableMfaInput): Promise<void>;
}
