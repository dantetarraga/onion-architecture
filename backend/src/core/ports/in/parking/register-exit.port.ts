import type { ParkingSession } from '../../../domain/entities/parking-session.entity';
import type { RegisterExitInput } from '../../../application/use-cases/parking/register-exit.use-case';

export interface RegisterExitPort {
  execute(input: RegisterExitInput): Promise<ParkingSession>;
}
