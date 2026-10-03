import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { CompareBranchesOccupancyPort } from '../../../../core/ports/in/branches/compare-branches-occupancy.port';
import type { GetBranchAvailabilityPort } from '../../../../core/ports/in/branches/get-branch-availability.port';
import type { ListBranchesPort } from '../../../../core/ports/in/branches/list-branches.port';
import {
  COMPARE_BRANCHES_OCCUPANCY,
  GET_BRANCH_AVAILABILITY,
  LIST_BRANCHES,
} from '../../../../core/ports/in/tokens';

@ApiTags('branches')
@Controller('branches')
export class BranchesController {
  constructor(
    @Inject(LIST_BRANCHES) private readonly listBranches: ListBranchesPort,
    @Inject(GET_BRANCH_AVAILABILITY)
    private readonly getBranchAvailability: GetBranchAvailabilityPort,
    @Inject(COMPARE_BRANCHES_OCCUPANCY)
    private readonly compareBranchesOccupancy: CompareBranchesOccupancyPort,
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
