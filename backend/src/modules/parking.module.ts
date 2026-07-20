import { Module } from '@nestjs/common';
import { GenerateEntryQrUseCase } from '../application/use-cases/parking/generate-entry-qr.use-case';
import { GenerateExitQrUseCase } from '../application/use-cases/parking/generate-exit-qr.use-case';
import { RegisterEntryUseCase } from '../application/use-cases/parking/register-entry.use-case';
import { RegisterExitUseCase } from '../application/use-cases/parking/register-exit.use-case';
import { ReportSlotBlockedUseCase } from '../application/use-cases/parking/report-slot-blocked.use-case';
import { CalculateAmountUseCase } from '../application/use-cases/payments/calculate-amount.use-case';
import { ParkingController } from '../presentation/http/controllers/parking.controller';

@Module({
  controllers: [ParkingController],
  providers: [
    GenerateEntryQrUseCase,
    RegisterEntryUseCase,
    GenerateExitQrUseCase,
    RegisterExitUseCase,
    ReportSlotBlockedUseCase,
    CalculateAmountUseCase,
  ],
})
export class ParkingModule {}
