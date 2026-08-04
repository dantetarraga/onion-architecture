import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { SlotType } from '../../../../../core/domain/enums/slot-type.enum';

export class ConfirmSuggestionDto {
  @IsString()
  suggestedBranchId!: string;

  @IsOptional()
  @IsEnum(SlotType)
  slotType?: SlotType;

  @IsOptional()
  @IsDateString()
  startAt?: string;
}
