import { IsString, Matches } from 'class-validator';

/** Codigo TOTP de 6 digitos (confirmar / desactivar MFA). */
export class MfaCodeDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El codigo debe tener 6 digitos.' })
  code!: string;
}
