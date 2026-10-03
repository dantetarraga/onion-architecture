import { Global, Module } from '@nestjs/common';
import { BRANCH_REPOSITORY, PARKING_SESSION_REPOSITORY, PARKING_SLOT_REPOSITORY, RESERVATION_REPOSITORY } from '../core/ports/out/tokens';
import { PrismaBranchRepository } from '../adapters/out/persistence/prisma/repositories/prisma-branch.repository';
import { PrismaParkingSessionRepository } from '../adapters/out/persistence/prisma/repositories/prisma-parking-session.repository';
import { PrismaParkingSlotRepository } from '../adapters/out/persistence/prisma/repositories/prisma-parking-slot.repository';
import { PrismaReservationRepository } from '../adapters/out/persistence/prisma/repositories/prisma-reservation.repository';

@Global()
@Module({
  providers: [
    { provide: BRANCH_REPOSITORY, useClass: PrismaBranchRepository },
    { provide: PARKING_SLOT_REPOSITORY, useClass: PrismaParkingSlotRepository },
    { provide: RESERVATION_REPOSITORY, useClass: PrismaReservationRepository },
    { provide: PARKING_SESSION_REPOSITORY, useClass: PrismaParkingSessionRepository },
  ],
  exports: [
    BRANCH_REPOSITORY,
    PARKING_SLOT_REPOSITORY,
    RESERVATION_REPOSITORY,
    PARKING_SESSION_REPOSITORY,
  ],
})
export class RepositoriesModule {}
