import { Inject, Injectable } from '@nestjs/common';
import { Branch } from '../../../domain/entities/branch.entity';
import type { BranchRepositoryPort } from '../../../domain/ports/branch.repository.port';
import { BRANCH_REPOSITORY } from '../../../domain/ports/tokens';

@Injectable()
export class ListBranchesUseCase {
  constructor(@Inject(BRANCH_REPOSITORY) private readonly branches: BranchRepositoryPort) {}

  async execute(): Promise<Branch[]> {
    return this.branches.findAll();
  }
}
