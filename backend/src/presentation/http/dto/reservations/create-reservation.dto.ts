import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { SlotType } from '../../../../domain/enums/slot-type.enum';

export class CreateReservationDto {
  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsEnum(SlotType)
  slotType?: SlotType;

  @IsOptional()
  @IsDateString()
  startAt?: string;
}
