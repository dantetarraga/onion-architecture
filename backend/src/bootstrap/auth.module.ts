import { Module } from '@nestjs/common';
import { LoginUserUseCase } from '../core/application/use-cases/auth/login-user.use-case';
import { RegisterUserUseCase } from '../core/application/use-cases/auth/register-user.use-case';
import { LOGIN_USER, REGISTER_USER } from '../core/ports/in/tokens';
import { AuthController } from '../adapters/in/http/controllers/auth.controller';

@Module({
  controllers: [AuthController],
  providers: [
    RegisterUserUseCase,
    LoginUserUseCase,
    { provide: REGISTER_USER, useExisting: RegisterUserUseCase },
    { provide: LOGIN_USER, useExisting: LoginUserUseCase },
  ],
})
export class AuthModule {}
