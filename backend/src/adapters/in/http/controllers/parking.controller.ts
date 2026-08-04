import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { CalculateAmountPort } from '../../../../core/ports/in/payments/calculate-amount.port';
import type { GenerateEntryQrPort } from '../../../../core/ports/in/parking/generate-entry-qr.port';
import type { GenerateExitQrPort } from '../../../../core/ports/in/parking/generate-exit-qr.port';
import type { RegisterEntryPort } from '../../../../core/ports/in/parking/register-entry.port';
import type { RegisterExitPort } from '../../../../core/ports/in/parking/register-exit.port';
import type { ReportSlotBlockedPort } from '../../../../core/ports/in/parking/report-slot-blocked.port';
import {
  CALCULATE_AMOUNT,
  GENERATE_ENTRY_QR,
  GENERATE_EXIT_QR,
  REGISTER_ENTRY,
  REGISTER_EXIT,
  REPORT_SLOT_BLOCKED,
} from '../../../../core/ports/in/tokens';
import type { AuthTokenPayload } from '../../../../core/ports/out/token.port';
import { CurrentUser } from '../decorators/current-user.decorator';
import { QrPayloadDto } from '../dto/parking/qr-payload.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('parking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ParkingController {
  constructor(
    @Inject(GENERATE_ENTRY_QR)
    private readonly generateEntryQr: GenerateEntryQrPort,
    @Inject(REGISTER_ENTRY) private readonly registerEntry: RegisterEntryPort,
    @Inject(GENERATE_EXIT_QR)
    private readonly generateExitQr: GenerateExitQrPort,
    @Inject(REGISTER_EXIT) private readonly registerExit: RegisterExitPort,
    @Inject(REPORT_SLOT_BLOCKED)
    private readonly reportSlotBlocked: ReportSlotBlockedPort,
    @Inject(CALCULATE_AMOUNT)
    private readonly calculateAmount: CalculateAmountPort,
  ) {}

  @Get('reservations/:id/qr')
  entryQr(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') reservationId: string,
  ) {
    return this.generateEntryQr.execute({ reservationId, userId: user.sub });
  }

  @Post('parking/entry')
  entry(@Body() dto: QrPayloadDto) {
    return this.registerEntry.execute({ qrPayload: dto.qrPayload });
  }

  @Get('parking/sessions/:id/qr')
  exitQr(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') sessionId: string,
  ) {
    return this.generateExitQr.execute({ sessionId, userId: user.sub });
  }

  @Post('parking/exit')
  exit(@Body() dto: QrPayloadDto) {
    return this.registerExit.execute({ qrPayload: dto.qrPayload });
  }

  @Get('parking/sessions/:id/amount')
  amount(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') sessionId: string,
  ) {
    return this.calculateAmount.execute({ sessionId, userId: user.sub });
  }

  @Post('parking/slots/:id/report-blocked')
  reportBlocked(@Param('id') slotId: string) {
    return this.reportSlotBlocked.execute(slotId);
  }
}
