import { api } from '@/lib/axios';
import type { Branch, BranchAvailability, BranchOccupancy } from '@/types/entities';

export const branchesApi = {
  list: () => api.get<Branch[]>('/branches').then((r) => r.data),
  occupancy: (ids?: string[]) =>
    api
      .get<BranchOccupancy[]>('/branches/occupancy', {
        params: ids?.length ? { ids: ids.join(',') } : undefined,
      })
      .then((r) => r.data),
  getById: (id: string) => api.get<Branch>(`/branches/${id}`).then((r) => r.data),
  availability: (id: string) => api.get<BranchAvailability>(`/branches/${id}/availability`).then((r) => r.data),
};
