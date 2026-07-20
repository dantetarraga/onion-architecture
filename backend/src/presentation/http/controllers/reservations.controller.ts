import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CancelReservationUseCase } from '../../../application/use-cases/reservations/cancel-reservation.use-case';
import { CreateReservationUseCase } from '../../../application/use-cases/reservations/create-reservation.use-case';
import { GetReservationUseCase } from '../../../application/use-cases/reservations/get-reservation.use-case';
import { ListReservationsUseCase } from '../../../application/use-cases/reservations/list-reservations.use-case';
import type { AuthTokenPayload } from '../../../application/ports/token.port';
import { ReservationStatus } from '../../../domain/enums/reservation-status.enum';
import { Role } from '../../../domain/enums/role.enum';
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
    private readonly createReservation: CreateReservationUseCase,
    private readonly cancelReservation: CancelReservationUseCase,
    private readonly getReservation: GetReservationUseCase,
    private readonly listReservations: ListReservationsUseCase,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthTokenPayload, @Body() dto: CreateReservationDto) {
    return this.createReservation.execute({ userId: user.sub, branchId: dto.branchId, slotType: dto.slotType });
  }

  @Post('confirm-suggestion')
  confirmSuggestion(@CurrentUser() user: AuthTokenPayload, @Body() dto: ConfirmSuggestionDto) {
    return this.createReservation.execute({
      userId: user.sub,
      branchId: dto.suggestedBranchId,
      slotType: dto.slotType,
    });
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  list(@Query('branchId') branchId?: string, @Query('status') status?: ReservationStatus) {
    return this.listReservations.execute({ branchId, status });
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.getReservation.execute(id);
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser() user: AuthTokenPayload, @Param('id') id: string) {
    return this.cancelReservation.execute({ reservationId: id, userId: user.sub });
  }
}
