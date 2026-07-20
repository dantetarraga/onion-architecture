import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CalculateAmountUseCase } from '../../../application/use-cases/payments/calculate-amount.use-case';
import { GenerateEntryQrUseCase } from '../../../application/use-cases/parking/generate-entry-qr.use-case';
import { GenerateExitQrUseCase } from '../../../application/use-cases/parking/generate-exit-qr.use-case';
import { RegisterEntryUseCase } from '../../../application/use-cases/parking/register-entry.use-case';
import { RegisterExitUseCase } from '../../../application/use-cases/parking/register-exit.use-case';
import { ReportSlotBlockedUseCase } from '../../../application/use-cases/parking/report-slot-blocked.use-case';
import type { AuthTokenPayload } from '../../../application/ports/token.port';
import { CurrentUser } from '../decorators/current-user.decorator';
import { QrPayloadDto } from '../dto/parking/qr-payload.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('parking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ParkingController {
  constructor(
    private readonly generateEntryQr: GenerateEntryQrUseCase,
    private readonly registerEntry: RegisterEntryUseCase,
    private readonly generateExitQr: GenerateExitQrUseCase,
    private readonly registerExit: RegisterExitUseCase,
    private readonly reportSlotBlocked: ReportSlotBlockedUseCase,
    private readonly calculateAmount: CalculateAmountUseCase,
  ) {}

  @Get('reservations/:id/qr')
  entryQr(@CurrentUser() user: AuthTokenPayload, @Param('id') reservationId: string) {
    return this.generateEntryQr.execute({ reservationId, userId: user.sub });
  }

  @Post('parking/entry')
  entry(@Body() dto: QrPayloadDto) {
    return this.registerEntry.execute({ qrPayload: dto.qrPayload });
  }

  @Get('parking/sessions/:id/qr')
  exitQr(@CurrentUser() user: AuthTokenPayload, @Param('id') sessionId: string) {
    return this.generateExitQr.execute({ sessionId, userId: user.sub });
  }

  @Post('parking/exit')
  exit(@Body() dto: QrPayloadDto) {
    return this.registerExit.execute({ qrPayload: dto.qrPayload });
  }

  @Get('parking/sessions/:id/amount')
  amount(@CurrentUser() user: AuthTokenPayload, @Param('id') sessionId: string) {
    return this.calculateAmount.execute({ sessionId, userId: user.sub });
  }

  @Post('parking/slots/:id/report-blocked')
  reportBlocked(@Param('id') slotId: string) {
    return this.reportSlotBlocked.execute(slotId);
  }
}
