import { Module } from '@nestjs/common';
import { AuthController } from '../adapters/in/http/controllers/auth.controller';
import { ConfirmMfaUseCase } from '../core/application/use-cases/auth/confirm-mfa.use-case';
import { DisableMfaUseCase } from '../core/application/use-cases/auth/disable-mfa.use-case';
import { LoginUserUseCase } from '../core/application/use-cases/auth/login-user.use-case';
import { LoginWithFacebookUseCase } from '../core/application/use-cases/auth/login-with-facebook.use-case';
import { LoginWithGoogleUseCase } from '../core/application/use-cases/auth/login-with-google.use-case';
import { RegisterUserUseCase } from '../core/application/use-cases/auth/register-user.use-case';
import { SetupMfaUseCase } from '../core/application/use-cases/auth/setup-mfa.use-case';
import { VerifyMfaUseCase } from '../core/application/use-cases/auth/verify-mfa.use-case';
import {
  CONFIRM_MFA,
  DISABLE_MFA,
  LOGIN_USER,
  LOGIN_WITH_FACEBOOK,
  LOGIN_WITH_GOOGLE,
  REGISTER_USER,
  SETUP_MFA,
  VERIFY_MFA,
} from '../core/ports/in/tokens';

@Module({
  controllers: [AuthController],
  providers: [
    RegisterUserUseCase,
    LoginUserUseCase,
    LoginWithGoogleUseCase,
    LoginWithFacebookUseCase,
    SetupMfaUseCase,
    ConfirmMfaUseCase,
    VerifyMfaUseCase,
    DisableMfaUseCase,
    { provide: REGISTER_USER, useExisting: RegisterUserUseCase },
    { provide: LOGIN_USER, useExisting: LoginUserUseCase },
    { provide: LOGIN_WITH_GOOGLE, useExisting: LoginWithGoogleUseCase },
    { provide: LOGIN_WITH_FACEBOOK, useExisting: LoginWithFacebookUseCase },
    { provide: SETUP_MFA, useExisting: SetupMfaUseCase },
    { provide: CONFIRM_MFA, useExisting: ConfirmMfaUseCase },
    { provide: VERIFY_MFA, useExisting: VerifyMfaUseCase },
    { provide: DISABLE_MFA, useExisting: DisableMfaUseCase },
  ],
})
export class AuthModule {}
