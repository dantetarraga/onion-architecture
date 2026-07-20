import { Injectable } from '@nestjs/common';
import { Branch } from '../../../../domain/entities/branch.entity';
import { BranchRepositoryPort } from '../../../../domain/ports/branch.repository.port';
import { BranchMapper } from '../mappers/branch.mapper';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaBranchRepository implements BranchRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Branch | null> {
    const record = await this.prisma.branch.findUnique({ where: { id } });
    return record ? BranchMapper.toDomain(record) : null;
  }

  async findAll(): Promise<Branch[]> {
    const records = await this.prisma.branch.findMany({ orderBy: { name: 'asc' } });
    return records.map(BranchMapper.toDomain);
  }

  async findByIds(ids: string[]): Promise<Branch[]> {
    const records = await this.prisma.branch.findMany({ where: { id: { in: ids } } });
    return records.map(BranchMapper.toDomain);
  }

  async findAllExcept(excludeBranchId: string): Promise<Branch[]> {
    const records = await this.prisma.branch.findMany({
      where: { id: { not: excludeBranchId } },
      orderBy: { name: 'asc' },
    });
    return records.map(BranchMapper.toDomain);
  }
}
