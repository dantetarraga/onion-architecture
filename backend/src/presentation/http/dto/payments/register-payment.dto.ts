import { IsUUID } from 'class-validator';

export class RegisterPaymentDto {
  @IsUUID()
  sessionId!: string;
}
