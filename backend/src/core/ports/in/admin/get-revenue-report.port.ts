import type {
  RevenueReportInput,
  RevenueReportRow,
} from '../../../application/use-cases/admin/get-revenue-report.use-case';

export interface GetRevenueReportPort {
  execute(input: RevenueReportInput): Promise<RevenueReportRow[]>;
}
