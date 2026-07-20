import { Global, Module } from '@nestjs/common';
import {
  BRANCH_REPOSITORY,
  PARKING_SESSION_REPOSITORY,
  PARKING_SLOT_REPOSITORY,
  PAYMENT_REPOSITORY,
  RESERVATION_REPOSITORY,
  USER_REPOSITORY,
} from '../../domain/ports/tokens';
import { PrismaBranchRepository } from '../persistence/prisma/repositories/prisma-branch.repository';
import { PrismaParkingSessionRepository } from '../persistence/prisma/repositories/prisma-parking-session.repository';
import { PrismaParkingSlotRepository } from '../persistence/prisma/repositories/prisma-parking-slot.repository';
import { PrismaPaymentRepository } from '../persistence/prisma/repositories/prisma-payment.repository';
import { PrismaReservationRepository } from '../persistence/prisma/repositories/prisma-reservation.repository';
import { PrismaUserRepository } from '../persistence/prisma/repositories/prisma-user.repository';

@Global()
@Module({
  providers: [
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: BRANCH_REPOSITORY, useClass: PrismaBranchRepository },
    { provide: PARKING_SLOT_REPOSITORY, useClass: PrismaParkingSlotRepository },
    { provide: RESERVATION_REPOSITORY, useClass: PrismaReservationRepository },
    { provide: PARKING_SESSION_REPOSITORY, useClass: PrismaParkingSessionRepository },
    { provide: PAYMENT_REPOSITORY, useClass: PrismaPaymentRepository },
  ],
  exports: [
    USER_REPOSITORY,
    BRANCH_REPOSITORY,
    PARKING_SLOT_REPOSITORY,
    RESERVATION_REPOSITORY,
    PARKING_SESSION_REPOSITORY,
    PAYMENT_REPOSITORY,
  ],
})
export class RepositoriesModule {}
