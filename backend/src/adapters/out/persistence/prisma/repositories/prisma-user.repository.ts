import { Injectable } from '@nestjs/common';
import { User } from '../../../../../core/domain/entities/user.entity';
import {
  CreateUserData,
  MfaCredentials,
  MfaCredentialsPatch,
  UserRepositoryPort,
} from '../../../../../core/ports/out/user.repository.port';
import { UserMapper } from '../mappers/user.mapper';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaUserRepository implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    return record ? UserMapper.toDomain(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { email } });
    return record ? UserMapper.toDomain(record) : null;
  }

  async create(data: CreateUserData): Promise<User> {
    const record = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        role: data.role,
      },
    });
    return UserMapper.toDomain(record);
  }

  async findMfaCredentials(userId: string): Promise<MfaCredentials | null> {
    const record = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        mfaEnabled: true,
        totpSecretEnc: true,
        totpLastStep: true,
        mfaBackupCodes: true,
      },
    });
    if (!record) return null;
    return {
      enabled: record.mfaEnabled,
      totpSecretEnc: record.totpSecretEnc,
      lastStep: record.totpLastStep,
      backupCodeHashes: record.mfaBackupCodes,
    };
  }

  async updateMfa(userId: string, patch: MfaCredentialsPatch): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(patch.enabled !== undefined && { mfaEnabled: patch.enabled }),
        ...(patch.totpSecretEnc !== undefined && {
          totpSecretEnc: patch.totpSecretEnc,
        }),
        ...(patch.lastStep !== undefined && { totpLastStep: patch.lastStep }),
        ...(patch.backupCodeHashes !== undefined && {
          mfaBackupCodes: patch.backupCodeHashes,
        }),
      },
    });
  }
}
