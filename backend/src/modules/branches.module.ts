import { Module } from '@nestjs/common';
import { CompareBranchesOccupancyUseCase } from '../application/use-cases/branches/compare-branches-occupancy.use-case';
import { GetBranchAvailabilityUseCase } from '../application/use-cases/branches/get-branch-availability.use-case';
import { ListBranchesUseCase } from '../application/use-cases/branches/list-branches.use-case';
import { BranchesController } from '../presentation/http/controllers/branches.controller';

@Module({
  controllers: [BranchesController],
  providers: [ListBranchesUseCase, GetBranchAvailabilityUseCase, CompareBranchesOccupancyUseCase],
  exports: [CompareBranchesOccupancyUseCase],
})
export class BranchesModule {}
