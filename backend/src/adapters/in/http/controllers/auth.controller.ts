import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { LoginUserPort } from '../../../../core/ports/in/auth/login-user.port';
import type { LoginWithFacebookPort } from '../../../../core/ports/in/auth/login-with-facebook.port';
import type { LoginWithGooglePort } from '../../../../core/ports/in/auth/login-with-google.port';
import type { RegisterUserPort } from '../../../../core/ports/in/auth/register-user.port';
import {
  LOGIN_USER,
  LOGIN_WITH_FACEBOOK,
  LOGIN_WITH_GOOGLE,
  REGISTER_USER,
} from '../../../../core/ports/in/tokens';
import { FacebookLoginDto } from '../dto/auth/facebook-login.dto';
import { GoogleLoginDto } from '../dto/auth/google-login.dto';
import { LoginDto } from '../dto/auth/login.dto';
import { RegisterDto } from '../dto/auth/register.dto';

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
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.registerUser.execute(dto);
  }

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
}
