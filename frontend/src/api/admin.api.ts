import { api } from '@/lib/axios';
import type { BranchOccupancy, RevenueReportRow } from '@/types/entities';

export const adminApi = {
  occupancyDashboard: () => api.get<BranchOccupancy[]>('/admin/dashboard/occupancy').then((r) => r.data),
  revenueReport: (params?: { branchId?: string; from?: string; to?: string }) =>
    api.get<RevenueReportRow[]>('/admin/reports/revenue', { params }).then((r) => r.data),
  simulateFull: (branchId: string) => api.post<void>(`/admin/branches/${branchId}/simulate-full`).then((r) => r.data),
  expireNow: () => api.post<void>('/admin/reservations/expire-now').then((r) => r.data),
};
