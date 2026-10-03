import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { SlotType } from '../../../../../core/domain/enums/slot-type.enum';

export class ConfirmSuggestionDto {
  @IsUUID()
  suggestedBranchId!: string;

  @IsOptional()
  @IsEnum(SlotType)
  slotType?: SlotType;

  @IsOptional()
  @IsDateString()
  startAt?: string;
}
