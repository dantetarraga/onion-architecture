import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { SlotType } from '../../../../domain/enums/slot-type.enum';

export class ConfirmSuggestionDto {
  @IsUUID()
  suggestedBranchId!: string;

  @IsOptional()
  @IsEnum(SlotType)
  slotType?: SlotType;
}
