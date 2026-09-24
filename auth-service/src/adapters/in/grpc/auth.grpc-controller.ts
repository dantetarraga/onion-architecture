import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type { User } from '../../../core/domain/entities/user.entity';
import type { ConfirmMfaPort } from '../../../core/ports/in/auth/confirm-mfa.port';
import type { DisableMfaPort } from '../../../core/ports/in/auth/disable-mfa.port';
import type { LoginUserPort } from '../../../core/ports/in/auth/login-user.port';
import type { LoginWithFacebookPort } from '../../../core/ports/in/auth/login-with-facebook.port';
import type { LoginWithGooglePort } from '../../../core/ports/in/auth/login-with-google.port';
import type { RegisterUserPort } from '../../../core/ports/in/auth/register-user.port';
import type { SetupMfaPort } from '../../../core/ports/in/auth/setup-mfa.port';
import type { VerifyMfaPort } from '../../../core/ports/in/auth/verify-mfa.port';
import type { GetCurrentUserPort } from '../../../core/ports/in/users/get-current-user.port';
import {
  CONFIRM_MFA,
  DISABLE_MFA,
  GET_CURRENT_USER,
  LOGIN_USER,
  LOGIN_WITH_FACEBOOK,
  LOGIN_WITH_GOOGLE,
  REGISTER_USER,
  SETUP_MFA,
  VERIFY_MFA,
} from '../../../core/ports/in/tokens';
import type { LoginUserResult } from '../../../core/application/use-cases/auth/issue-session';
import { callUseCase } from './grpc-domain-error';

function toUserReply(user: User) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    mfaEnabled: user.mfaEnabled,
    createdAt: user.createdAt.toISOString(),
  };
}

function toLoginReply(result: LoginUserResult) {
  if (result.mfaRequired) {
    return { mfaChallenge: { mfaToken: result.mfaToken } };
  }
  return {
    fullSession: {
      accessToken: result.accessToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role,
      },
    },
  };
}

@Controller()
export class AuthGrpcController {
  constructor(
    @Inject(REGISTER_USER) private readonly registerUser: RegisterUserPort,
    @Inject(LOGIN_USER) private readonly loginUser: LoginUserPort,
    @Inject(LOGIN_WITH_GOOGLE)
    private readonly loginWithGoogle: LoginWithGooglePort,
    @Inject(LOGIN_WITH_FACEBOOK)
    private readonly loginWithFacebook: LoginWithFacebookPort,
    @Inject(SETUP_MFA) private readonly setupMfa: SetupMfaPort,
    @Inject(CONFIRM_MFA) private readonly confirmMfa: ConfirmMfaPort,
    @Inject(VERIFY_MFA) private readonly verifyMfa: VerifyMfaPort,
    @Inject(DISABLE_MFA) private readonly disableMfa: DisableMfaPort,
    @Inject(GET_CURRENT_USER)
    private readonly getCurrentUser: GetCurrentUserPort,
  ) {}

  @GrpcMethod('AuthService', 'Register')
  async register(data: { email: string; password: string; fullName: string }) {
    const user = await callUseCase(() => this.registerUser.execute(data));
    return toUserReply(user);
  }

  @GrpcMethod('AuthService', 'Login')
  async login(data: { email: string; password: string }) {
    const result = await callUseCase(() => this.loginUser.execute(data));
    return toLoginReply(result);
  }

  @GrpcMethod('AuthService', 'LoginWithGoogle')
  async loginWithGoogleRpc(data: { idToken: string }) {
    const result = await callUseCase(() =>
      this.loginWithGoogle.execute(data),
    );
    return toLoginReply(result);
  }

  @GrpcMethod('AuthService', 'LoginWithFacebook')
  async loginWithFacebookRpc(data: { accessToken: string }) {
    const result = await callUseCase(() =>
      this.loginWithFacebook.execute(data),
    );
    return toLoginReply(result);
  }

  @GrpcMethod('AuthService', 'VerifyMfa')
  async verifyMfaRpc(data: { mfaToken: string; code: string }) {
    const result = await callUseCase(() => this.verifyMfa.execute(data));
    return toLoginReply(result);
  }

  @GrpcMethod('AuthService', 'SetupMfa')
  async setupMfaRpc(data: { userId: string }) {
    const result = await callUseCase(() =>
      this.setupMfa.execute({ userId: data.userId }),
    );
    return { secret: result.secret, otpauthUri: result.otpauthUri };
  }

  @GrpcMethod('AuthService', 'ConfirmMfa')
  async confirmMfaRpc(data: { userId: string; code: string }) {
    const result = await callUseCase(() => this.confirmMfa.execute(data));
    return { backupCodes: result.backupCodes };
  }

  @GrpcMethod('AuthService', 'DisableMfa')
  async disableMfaRpc(data: { userId: string; code: string }) {
    await callUseCase(() => this.disableMfa.execute(data));
    return {};
  }

  @GrpcMethod('AuthService', 'GetUserById')
  async getUserByIdRpc(data: { userId: string }) {
    const user = await callUseCase(() =>
      this.getCurrentUser.execute(data.userId),
    );
    return toUserReply(user);
  }
}
