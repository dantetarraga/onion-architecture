import { Branch as PrismaBranch } from '@prisma/client';
import { Branch } from '../../../../domain/entities/branch.entity';

export class BranchMapper {
  static toDomain(record: PrismaBranch): Branch {
    return new Branch({
      id: record.id,
      name: record.name,
      address: record.address,
      lat: record.lat,
      lng: record.lng,
      pricePerHour: record.pricePerHour.toNumber(),
      createdAt: record.createdAt,
    });
  }
}
