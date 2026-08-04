import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { SlotType } from '../../../../domain/enums/slot-type.enum';

export class CreateReservationDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsEnum(SlotType)
  slotType?: SlotType;

  @IsOptional()
  @IsDateString()
  startAt?: string;
}
