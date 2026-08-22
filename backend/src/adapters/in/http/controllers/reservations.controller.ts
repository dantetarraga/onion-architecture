import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiAcceptedResponse, ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { CancelReservationPort } from '../../../../core/ports/in/reservations/cancel-reservation.port';
import type { GetReservationPort } from '../../../../core/ports/in/reservations/get-reservation.port';
import type { ListReservationsPort } from '../../../../core/ports/in/reservations/list-reservations.port';
import type { RequestReservationPort } from '../../../../core/ports/in/reservations/request-reservation.port';
import {
  CANCEL_RESERVATION,
  GET_RESERVATION,
  LIST_RESERVATIONS,
  REQUEST_RESERVATION,
} from '../../../../core/ports/in/tokens';
import type { AuthTokenPayload } from '../../../../core/ports/out/token.port';
import { ReservationStatus } from '../../../../core/domain/enums/reservation-status.enum';
import { Role } from '../../../../core/domain/enums/role.enum';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { ConfirmSuggestionDto } from '../dto/reservations/confirm-suggestion.dto';
import { CreateReservationDto } from '../dto/reservations/create-reservation.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';

@ApiTags('reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(
    @Inject(REQUEST_RESERVATION)
    private readonly requestReservation: RequestReservationPort,
    @Inject(CANCEL_RESERVATION)
    private readonly cancelReservation: CancelReservationPort,
    @Inject(GET_RESERVATION)
    private readonly getReservation: GetReservationPort,
    @Inject(LIST_RESERVATIONS)
    private readonly listReservations: ListReservationsPort,
  ) {}

  /**
   * No crea la reserva: la encola. El worker la procesa y el desenlace
   * (CREATED / SUGGEST_OTHER_BRANCH / REJECTED) llega por WebSocket en el
   * evento `reservation.request.resolved`, correlacionado por `requestId`.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({
    description:
      'Solicitud encolada. El resultado llega por WebSocket en "reservation.request.resolved".',
  })
  create(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: CreateReservationDto,
  ) {
    return this.requestReservation.execute({
      userId: user.sub,
      branchId: dto.branchId,
      slotType: dto.slotType,
      startAt: dto.startAt ? new Date(dto.startAt) : undefined,
    });
  }

  @Post('confirm-suggestion')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({
    description:
      'Solicitud encolada sobre la sucursal sugerida. El worker revalida la disponibilidad en cascada.',
  })
  confirmSuggestion(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: ConfirmSuggestionDto,
  ) {
    return this.requestReservation.execute({
      userId: user.sub,
      branchId: dto.suggestedBranchId,
      slotType: dto.slotType,
      startAt: dto.startAt ? new Date(dto.startAt) : undefined,
    });
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  list(
    @Query('branchId') branchId?: string,
    @Query('status') status?: ReservationStatus,
  ) {
    return this.listReservations.execute({ branchId, status });
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.getReservation.execute(id);
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser() user: AuthTokenPayload, @Param('id') id: string) {
    return this.cancelReservation.execute({
      reservationId: id,
      userId: user.sub,
    });
  }
}
