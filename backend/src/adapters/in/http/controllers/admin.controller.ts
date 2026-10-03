import {
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { GetOccupancyDashboardPort } from '../../../../core/ports/in/admin/get-occupancy-dashboard.port';
import type { GetRevenueReportPort } from '../../../../core/ports/in/admin/get-revenue-report.port';
import type { SimulateBranchFullPort } from '../../../../core/ports/in/admin/simulate-branch-full.port';
import type { ExpireOverdueReservationsPort } from '../../../../core/ports/in/reservations/expire-overdue-reservations.port';
import {
  GET_OCCUPANCY_DASHBOARD,
  GET_REVENUE_REPORT,
  SIMULATE_BRANCH_FULL,
  EXPIRE_OVERDUE_RESERVATIONS,
} from '../../../../core/ports/in/tokens';
import { Role } from '../../../../core/domain/enums/role.enum';
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
    @Inject(GET_OCCUPANCY_DASHBOARD)
    private readonly getOccupancyDashboard: GetOccupancyDashboardPort,
    @Inject(GET_REVENUE_REPORT)
    private readonly getRevenueReport: GetRevenueReportPort,
    @Inject(SIMULATE_BRANCH_FULL)
    private readonly simulateBranchFull: SimulateBranchFullPort,
    @Inject(EXPIRE_OVERDUE_RESERVATIONS)
    private readonly expireOverdueReservations: ExpireOverdueReservationsPort,
  ) {}

  @Get('dashboard/occupancy')
  dashboardOccupancy() {
    return this.getOccupancyDashboard.execute();
  }

  @Get('reports/revenue')
  revenueReport(
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
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
