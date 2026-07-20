import { Module } from '@nestjs/common';
import { GetOccupancyDashboardUseCase } from '../application/use-cases/admin/get-occupancy-dashboard.use-case';
import { GetRevenueReportUseCase } from '../application/use-cases/admin/get-revenue-report.use-case';
import { SimulateBranchFullUseCase } from '../application/use-cases/admin/simulate-branch-full.use-case';
import { AdminController } from '../presentation/http/controllers/admin.controller';
import { BranchesModule } from './branches.module';
import { ReservationsModule } from './reservations.module';

@Module({
  imports: [BranchesModule, ReservationsModule],
  controllers: [AdminController],
  providers: [GetOccupancyDashboardUseCase, GetRevenueReportUseCase, SimulateBranchFullUseCase],
})
export class AdminModule {}
