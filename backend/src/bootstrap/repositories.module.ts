import { Global, Module } from '@nestjs/common';
import { BRANCH_REPOSITORY, PARKING_SESSION_REPOSITORY, PARKING_SLOT_REPOSITORY, PAYMENT_REPOSITORY, RESERVATION_REPOSITORY, USER_REPOSITORY } from '../core/ports/out/tokens';
import { MongoBranchRepository } from '../adapters/out/persistence/mongodb/repositories/mongo-branch.repository';
import { MongoParkingSessionRepository } from '../adapters/out/persistence/mongodb/repositories/mongo-parking-session.repository';
import { MongoParkingSlotRepository } from '../adapters/out/persistence/mongodb/repositories/mongo-parking-slot.repository';
import { MongoPaymentRepository } from '../adapters/out/persistence/mongodb/repositories/mongo-payment.repository';
import { MongoReservationRepository } from '../adapters/out/persistence/mongodb/repositories/mongo-reservation.repository';
import { MongoUserRepository } from '../adapters/out/persistence/mongodb/repositories/mongo-user.repository';

@Global()
@Module({
  providers: [
    { provide: USER_REPOSITORY, useClass: MongoUserRepository },
    { provide: BRANCH_REPOSITORY, useClass: MongoBranchRepository },
    { provide: PARKING_SLOT_REPOSITORY, useClass: MongoParkingSlotRepository },
    { provide: RESERVATION_REPOSITORY, useClass: MongoReservationRepository },
    { provide: PARKING_SESSION_REPOSITORY, useClass: MongoParkingSessionRepository },
    { provide: PAYMENT_REPOSITORY, useClass: MongoPaymentRepository },
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
