import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { LoginUserPort } from '../../../../core/ports/in/auth/login-user.port';
import type { RegisterUserPort } from '../../../../core/ports/in/auth/register-user.port';
import { LOGIN_USER, REGISTER_USER } from '../../../../core/ports/in/tokens';
import { LoginDto } from '../dto/auth/login.dto';
import { RegisterDto } from '../dto/auth/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(REGISTER_USER) private readonly registerUser: RegisterUserPort,
    @Inject(LOGIN_USER) private readonly loginUser: LoginUserPort,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.registerUser.execute(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.loginUser.execute(dto);
  }
}
