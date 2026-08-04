import { Module } from '@nestjs/common';
import { CompareBranchesOccupancyUseCase } from '../core/application/use-cases/branches/compare-branches-occupancy.use-case';
import { GetBranchAvailabilityUseCase } from '../core/application/use-cases/branches/get-branch-availability.use-case';
import { ListBranchesUseCase } from '../core/application/use-cases/branches/list-branches.use-case';
import {
  COMPARE_BRANCHES_OCCUPANCY,
  GET_BRANCH_AVAILABILITY,
  LIST_BRANCHES,
} from '../core/ports/in/tokens';
import { BranchesController } from '../adapters/in/http/controllers/branches.controller';

@Module({
  controllers: [BranchesController],
  providers: [
    ListBranchesUseCase,
    GetBranchAvailabilityUseCase,
    CompareBranchesOccupancyUseCase,
    { provide: LIST_BRANCHES, useExisting: ListBranchesUseCase },
    {
      provide: GET_BRANCH_AVAILABILITY,
      useExisting: GetBranchAvailabilityUseCase,
    },
    {
      provide: COMPARE_BRANCHES_OCCUPANCY,
      useExisting: CompareBranchesOccupancyUseCase,
    },
  ],
  exports: [CompareBranchesOccupancyUseCase],
})
export class BranchesModule {}
