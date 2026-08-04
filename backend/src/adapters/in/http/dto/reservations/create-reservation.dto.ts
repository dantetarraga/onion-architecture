import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { SlotType } from '../../../../../core/domain/enums/slot-type.enum';

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
