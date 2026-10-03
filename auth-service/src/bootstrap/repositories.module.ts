import { Global, Module } from '@nestjs/common';
import { PrismaUserRepository } from '../adapters/out/persistence/prisma/repositories/prisma-user.repository';
import { USER_REPOSITORY } from '../core/ports/out/tokens';

@Global()
@Module({
  providers: [{ provide: USER_REPOSITORY, useClass: PrismaUserRepository }],
  exports: [USER_REPOSITORY],
})
export class RepositoriesModule {}
