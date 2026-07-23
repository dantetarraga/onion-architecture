import { IsEnum, IsUUID } from 'class-validator';
import { PaymentMethodType } from '../../../../domain/enums/payment-method-type.enum';

export class RegisterPaymentDto {
  @IsUUID()
  sessionId!: string;

  @IsEnum(PaymentMethodType)
  method!: PaymentMethodType;
}
