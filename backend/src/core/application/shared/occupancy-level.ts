export type OccupancyLevel = 'GREEN' | 'YELLOW' | 'RED';

export function computeOccupancyLevel(occupied: number, total: number): OccupancyLevel {
  if (total === 0) return 'GREEN';
  const ratio = occupied / total;
  if (ratio < 0.5) return 'GREEN';
  if (ratio < 0.85) return 'YELLOW';
  return 'RED';
}
