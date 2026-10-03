import { IsString, MaxLength, MinLength } from 'class-validator';

/** Segundo factor del login: token intermedio + codigo TOTP o codigo de respaldo. */
export class MfaVerifyDto {
  @IsString()
  @MinLength(10)
  mfaToken!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(12)
  code!: string;
}
