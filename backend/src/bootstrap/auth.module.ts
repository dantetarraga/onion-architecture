import { Module } from '@nestjs/common';
import { AuthController } from '../adapters/in/http/controllers/auth.controller';
import { LoginUserUseCase } from '../core/application/use-cases/auth/login-user.use-case';
import { LoginWithFacebookUseCase } from '../core/application/use-cases/auth/login-with-facebook.use-case';
import { LoginWithGoogleUseCase } from '../core/application/use-cases/auth/login-with-google.use-case';
import { RegisterUserUseCase } from '../core/application/use-cases/auth/register-user.use-case';
import {
  LOGIN_USER,
  LOGIN_WITH_FACEBOOK,
  LOGIN_WITH_GOOGLE,
  REGISTER_USER,
} from '../core/ports/in/tokens';

@Module({
  controllers: [AuthController],
  providers: [
    RegisterUserUseCase,
    LoginUserUseCase,
    LoginWithGoogleUseCase,
    LoginWithFacebookUseCase,
    { provide: REGISTER_USER, useExisting: RegisterUserUseCase },
    { provide: LOGIN_USER, useExisting: LoginUserUseCase },
    { provide: LOGIN_WITH_GOOGLE, useExisting: LoginWithGoogleUseCase },
    { provide: LOGIN_WITH_FACEBOOK, useExisting: LoginWithFacebookUseCase },
  ],
})
export class AuthModule {}
