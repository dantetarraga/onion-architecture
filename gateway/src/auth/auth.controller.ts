import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthTokenPayload } from '../common/auth-token-payload';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { AuthGrpcClient, toLoginResult } from './auth-grpc.client';
import { FacebookLoginDto } from './dto/facebook-login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { MfaCodeDto } from './dto/mfa-code.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { RegisterDto } from './dto/register.dto';
import { callAuthRpc } from './grpc-error.util';

/** Mismo limite que backend tenia en sus rutas MFA: 5 intentos/min por IP. */
const MFA_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authGrpc: AuthGrpcClient) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return callAuthRpc(this.authGrpc.auth.register(dto));
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return toLoginResult(await callAuthRpc(this.authGrpc.auth.login(dto)));
  }

  @Post('google')
  async loginWithGoogleProvider(@Body() dto: GoogleLoginDto) {
    return toLoginResult(
      await callAuthRpc(this.authGrpc.auth.loginWithGoogle(dto)),
    );
  }

  @Post('facebook')
  async loginWithFacebookProvider(@Body() dto: FacebookLoginDto) {
    return toLoginResult(
      await callAuthRpc(this.authGrpc.auth.loginWithFacebook(dto)),
    );
  }

  @Post('mfa/verify')
  @UseGuards(ThrottlerGuard)
  @Throttle(MFA_THROTTLE)
  async verifyMfaCode(@Body() dto: MfaVerifyDto) {
    return toLoginResult(await callAuthRpc(this.authGrpc.auth.verifyMfa(dto)));
  }

  @Post('mfa/setup')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  setupMfaSecret(@CurrentUser() user: AuthTokenPayload) {
    return callAuthRpc(this.authGrpc.auth.setupMfa({ userId: user.sub }));
  }

  @Post('mfa/confirm')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle(MFA_THROTTLE)
  confirmMfaSetup(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: MfaCodeDto,
  ) {
    return callAuthRpc(
      this.authGrpc.auth.confirmMfa({ userId: user.sub, code: dto.code }),
    );
  }

  @Delete('mfa')
  @HttpCode(204)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle(MFA_THROTTLE)
  async disableMfaFactor(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: MfaCodeDto,
  ) {
    await callAuthRpc(
      this.authGrpc.auth.disableMfa({ userId: user.sub, code: dto.code }),
    );
  }
}
