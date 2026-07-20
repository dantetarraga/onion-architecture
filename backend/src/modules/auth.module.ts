import { Module } from '@nestjs/common';
import { LoginUserUseCase } from '../application/use-cases/auth/login-user.use-case';
import { RegisterUserUseCase } from '../application/use-cases/auth/register-user.use-case';
import { AuthController } from '../presentation/http/controllers/auth.controller';

@Module({
  controllers: [AuthController],
  providers: [RegisterUserUseCase, LoginUserUseCase],
})
export class AuthModule {}
