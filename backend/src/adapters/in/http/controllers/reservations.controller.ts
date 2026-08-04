import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { CancelReservationPort } from '../../../../core/ports/in/reservations/cancel-reservation.port';
import type { CreateReservationPort } from '../../../../core/ports/in/reservations/create-reservation.port';
import type { GetReservationPort } from '../../../../core/ports/in/reservations/get-reservation.port';
import type { ListReservationsPort } from '../../../../core/ports/in/reservations/list-reservations.port';
import {
  CANCEL_RESERVATION,
  CREATE_RESERVATION,
  GET_RESERVATION,
  LIST_RESERVATIONS,
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
    @Inject(CREATE_RESERVATION)
    private readonly createReservation: CreateReservationPort,
    @Inject(CANCEL_RESERVATION)
    private readonly cancelReservation: CancelReservationPort,
    @Inject(GET_RESERVATION)
    private readonly getReservation: GetReservationPort,
    @Inject(LIST_RESERVATIONS)
    private readonly listReservations: ListReservationsPort,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: CreateReservationDto,
  ) {
    return this.createReservation.execute({
      userId: user.sub,
      branchId: dto.branchId,
      slotType: dto.slotType,
      startAt: dto.startAt ? new Date(dto.startAt) : undefined,
    });
  }

  @Post('confirm-suggestion')
  confirmSuggestion(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: ConfirmSuggestionDto,
  ) {
    return this.createReservation.execute({
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
