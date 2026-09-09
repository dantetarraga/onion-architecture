import { IsString } from 'class-validator';

export class QrPayloadDto {
  @IsString()
  qrPayload!: string;
}
