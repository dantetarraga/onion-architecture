import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CompareBranchesOccupancyUseCase } from '../../../application/use-cases/branches/compare-branches-occupancy.use-case';
import { GetBranchAvailabilityUseCase } from '../../../application/use-cases/branches/get-branch-availability.use-case';
import { ListBranchesUseCase } from '../../../application/use-cases/branches/list-branches.use-case';

@ApiTags('branches')
@Controller('branches')
export class BranchesController {
  constructor(
    private readonly listBranches: ListBranchesUseCase,
    private readonly getBranchAvailability: GetBranchAvailabilityUseCase,
    private readonly compareBranchesOccupancy: CompareBranchesOccupancyUseCase,
  ) {}

  @Get()
  list() {
    return this.listBranches.execute();
  }

  @Get('occupancy')
  occupancy(@Query('ids') ids?: string) {
    const branchIds = ids ? ids.split(',') : undefined;
    return this.compareBranchesOccupancy.execute(branchIds);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const result = await this.getBranchAvailability.execute(id);
    return result.branch;
  }

  @Get(':id/availability')
  availability(@Param('id') id: string) {
    return this.getBranchAvailability.execute(id);
  }
}
