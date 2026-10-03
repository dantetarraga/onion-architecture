import type { Branch } from '../../../domain/entities/branch.entity';

export interface ListBranchesPort {
  execute(): Promise<Branch[]>;
}
