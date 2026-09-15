import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { ConfirmMfaPort } from '../../../../core/ports/in/auth/confirm-mfa.port';
import type { DisableMfaPort } from '../../../../core/ports/in/auth/disable-mfa.port';
import type { LoginUserPort } from '../../../../core/ports/in/auth/login-user.port';
import type { LoginWithFacebookPort } from '../../../../core/ports/in/auth/login-with-facebook.port';
import type { LoginWithGooglePort } from '../../../../core/ports/in/auth/login-with-google.port';
import type { RegisterUserPort } from '../../../../core/ports/in/auth/register-user.port';
import type { SetupMfaPort } from '../../../../core/ports/in/auth/setup-mfa.port';
import type { VerifyMfaPort } from '../../../../core/ports/in/auth/verify-mfa.port';
import {
  CONFIRM_MFA,
  DISABLE_MFA,
  LOGIN_USER,
  LOGIN_WITH_FACEBOOK,
  LOGIN_WITH_GOOGLE,
  REGISTER_USER,
  SETUP_MFA,
  VERIFY_MFA,
} from '../../../../core/ports/in/tokens';
import type { AuthTokenPayload } from '../../../../core/ports/out/token.port';
import { CurrentUser } from '../decorators/current-user.decorator';
import { FacebookLoginDto } from '../dto/auth/facebook-login.dto';
import { GoogleLoginDto } from '../dto/auth/google-login.dto';
import { LoginDto } from '../dto/auth/login.dto';
import { MfaCodeDto } from '../dto/auth/mfa-code.dto';
import { MfaVerifyDto } from '../dto/auth/mfa-verify.dto';
import { RegisterDto } from '../dto/auth/register.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

/**
 * Un TOTP tiene 10^6 combinaciones y vale ~90 s: sin limite de intentos se
 * fuerza por fuerza bruta en minutos. 5 intentos por minuto por IP en los
 * endpoints que reciben un codigo.
 */
const MFA_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
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
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.registerUser.execute(dto);
  }

  /** Responde `{ accessToken, user }` o, si el usuario tiene MFA, `{ mfaRequired: true, mfaToken }`. */
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.loginUser.execute(dto);
  }

  /** Login/registro con Google (Firebase Authentication). Ver LoginWithGoogleUseCase. */
  @Post('google')
  loginWithGoogleProvider(@Body() dto: GoogleLoginDto) {
    return this.loginWithGoogle.execute(dto);
  }

  @Post('facebook')
  loginWithFacebookProvider(@Body() dto: FacebookLoginDto) {
    return this.loginWithFacebook.execute(dto);
  }

  // --- MFA (TOTP / Google Authenticator) ---

  /** Segundo factor del login: canjea el mfaToken + codigo por el accessToken definitivo. */
  @Post('mfa/verify')
  @UseGuards(ThrottlerGuard)
  @Throttle(MFA_THROTTLE)
  verifyMfaCode(@Body() dto: MfaVerifyDto) {
    return this.verifyMfa.execute(dto);
  }

  /** Genera el secreto y devuelve el QR (otpauth URI). No activa nada hasta confirmar. */
  @Post('mfa/setup')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  setupMfaSecret(@CurrentUser() user: AuthTokenPayload) {
    return this.setupMfa.execute({ userId: user.sub });
  }

  /** Primer codigo correcto: activa MFA y devuelve los codigos de respaldo (una sola vez). */
  @Post('mfa/confirm')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle(MFA_THROTTLE)
  confirmMfaSetup(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: MfaCodeDto,
  ) {
    return this.confirmMfa.execute({ userId: user.sub, code: dto.code });
  }

  /** Desactiva MFA; exige un codigo vigente para que una sesion robada no pueda apagarlo sola. */
  @Delete('mfa')
  @HttpCode(204)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle(MFA_THROTTLE)
  disableMfaFactor(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: MfaCodeDto,
  ) {
    return this.disableMfa.execute({ userId: user.sub, code: dto.code });
  }
}
