import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GetOccupancyDashboardUseCase } from '../../../application/use-cases/admin/get-occupancy-dashboard.use-case';
import { GetRevenueReportUseCase } from '../../../application/use-cases/admin/get-revenue-report.use-case';
import { SimulateBranchFullUseCase } from '../../../application/use-cases/admin/simulate-branch-full.use-case';
import { ExpireOverdueReservationsUseCase } from '../../../application/use-cases/reservations/expire-overdue-reservations.use-case';
import { Role } from '../../../domain/enums/role.enum';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly getOccupancyDashboard: GetOccupancyDashboardUseCase,
    private readonly getRevenueReport: GetRevenueReportUseCase,
    private readonly simulateBranchFull: SimulateBranchFullUseCase,
    private readonly expireOverdueReservations: ExpireOverdueReservationsUseCase,
  ) {}

  @Get('dashboard/occupancy')
  dashboardOccupancy() {
    return this.getOccupancyDashboard.execute();
  }

  @Get('reports/revenue')
  revenueReport(@Query('branchId') branchId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.getRevenueReport.execute({
      branchId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Post('branches/:id/simulate-full')
  simulateFull(@Param('id') branchId: string) {
    return this.simulateBranchFull.execute(branchId);
  }

  @Post('reservations/expire-now')
  expireNow() {
    return this.expireOverdueReservations.execute();
  }
}
