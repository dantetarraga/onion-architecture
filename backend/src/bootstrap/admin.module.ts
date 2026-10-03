import { Module } from '@nestjs/common';
import { GetOccupancyDashboardUseCase } from '../core/application/use-cases/admin/get-occupancy-dashboard.use-case';
import { GetRevenueReportUseCase } from '../core/application/use-cases/admin/get-revenue-report.use-case';
import { SimulateBranchFullUseCase } from '../core/application/use-cases/admin/simulate-branch-full.use-case';
import {
  GET_OCCUPANCY_DASHBOARD,
  GET_REVENUE_REPORT,
  SIMULATE_BRANCH_FULL,
} from '../core/ports/in/tokens';
import { AdminController } from '../adapters/in/http/controllers/admin.controller';
import { BranchesModule } from './branches.module';
import { ReservationsModule } from './reservations.module';

@Module({
  imports: [BranchesModule, ReservationsModule],
  controllers: [AdminController],
  providers: [
    GetOccupancyDashboardUseCase,
    GetRevenueReportUseCase,
    SimulateBranchFullUseCase,
    {
      provide: GET_OCCUPANCY_DASHBOARD,
      useExisting: GetOccupancyDashboardUseCase,
    },
    { provide: GET_REVENUE_REPORT, useExisting: GetRevenueReportUseCase },
    { provide: SIMULATE_BRANCH_FULL, useExisting: SimulateBranchFullUseCase },
  ],
})
export class AdminModule {}
