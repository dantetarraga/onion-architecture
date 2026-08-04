export interface ExpireOverdueReservationsPort {
  execute(): Promise<number>;
}
