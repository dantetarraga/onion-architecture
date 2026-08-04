import { Module } from '@nestjs/common';
import { GenerateEntryQrUseCase } from '../core/application/use-cases/parking/generate-entry-qr.use-case';
import { GenerateExitQrUseCase } from '../core/application/use-cases/parking/generate-exit-qr.use-case';
import { RegisterEntryUseCase } from '../core/application/use-cases/parking/register-entry.use-case';
import { RegisterExitUseCase } from '../core/application/use-cases/parking/register-exit.use-case';
import { ReportSlotBlockedUseCase } from '../core/application/use-cases/parking/report-slot-blocked.use-case';
import { CalculateAmountUseCase } from '../core/application/use-cases/payments/calculate-amount.use-case';
import {
  CALCULATE_AMOUNT,
  GENERATE_ENTRY_QR,
  GENERATE_EXIT_QR,
  REGISTER_ENTRY,
  REGISTER_EXIT,
  REPORT_SLOT_BLOCKED,
} from '../core/ports/in/tokens';
import { ParkingController } from '../adapters/in/http/controllers/parking.controller';

@Module({
  controllers: [ParkingController],
  providers: [
    GenerateEntryQrUseCase,
    RegisterEntryUseCase,
    GenerateExitQrUseCase,
    RegisterExitUseCase,
    ReportSlotBlockedUseCase,
    CalculateAmountUseCase,
    { provide: GENERATE_ENTRY_QR, useExisting: GenerateEntryQrUseCase },
    { provide: REGISTER_ENTRY, useExisting: RegisterEntryUseCase },
    { provide: GENERATE_EXIT_QR, useExisting: GenerateExitQrUseCase },
    { provide: REGISTER_EXIT, useExisting: RegisterExitUseCase },
    { provide: REPORT_SLOT_BLOCKED, useExisting: ReportSlotBlockedUseCase },
    { provide: CALCULATE_AMOUNT, useExisting: CalculateAmountUseCase },
  ],
})
export class ParkingModule {}
