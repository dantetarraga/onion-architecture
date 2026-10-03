export interface SimulateBranchFullPort {
  execute(branchId: string): Promise<void>;
}
