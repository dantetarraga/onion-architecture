import { Inject, Injectable } from '@nestjs/common';
import { Branch } from '../../../domain/entities/branch.entity';
import type { BranchRepositoryPort } from '../../../ports/out/branch.repository.port';
import { BRANCH_REPOSITORY } from '../../../ports/out/tokens';
import type { ListBranchesPort } from '../../../ports/in/branches/list-branches.port';

@Injectable()
export class ListBranchesUseCase implements ListBranchesPort {
  constructor(
    @Inject(BRANCH_REPOSITORY) private readonly branches: BranchRepositoryPort,
  ) {}

  async execute(): Promise<Branch[]> {
    return this.branches.findAll();
  }
}
