import { Branch } from '../entities/branch.entity';

export interface BranchRepositoryPort {
  findById(id: string): Promise<Branch | null>;
  findAll(): Promise<Branch[]>;
  findByIds(ids: string[]): Promise<Branch[]>;
  /** Todas las sucursales excepto excludeBranchId, ordenadas por relevancia futura (hoy: todas). */
  findAllExcept(excludeBranchId: string): Promise<Branch[]>;
}
