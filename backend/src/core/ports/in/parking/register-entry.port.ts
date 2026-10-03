import type { ParkingSession } from '../../../domain/entities/parking-session.entity';
import type { RegisterEntryInput } from '../../../application/use-cases/parking/register-entry.use-case';

export interface RegisterEntryPort {
  execute(input: RegisterEntryInput): Promise<ParkingSession>;
}
