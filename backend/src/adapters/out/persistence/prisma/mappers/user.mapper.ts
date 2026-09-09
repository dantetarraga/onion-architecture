import { User as PrismaUser } from '@prisma/client';
import { User } from '../../../../../core/domain/entities/user.entity';
import { Role } from '../../../../../core/domain/enums/role.enum';

export class UserMapper {
  static toDomain(record: PrismaUser): User {
    return new User({
      id: record.id,
      email: record.email,
      passwordHash: record.passwordHash,
      fullName: record.fullName,
      role: record.role as unknown as Role,
      createdAt: record.createdAt,
    });
  }
}
