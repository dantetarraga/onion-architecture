import type {
  OccupancyLevel,
  PaymentStatus,
  ReservationStatus,
  Role,
  SessionStatus,
  SlotType,
} from './enums';

export interface Branch {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  pricePerHour: number;
  createdAt: string;
}

export interface SlotAvailabilityCount {
  type: SlotType;
  total: number;
  available: number;
}

export interface BranchAvailability {
  branch: Branch;
  availability: SlotAvailabilityCount[];
}

export interface BranchOccupancy {
  branch: Branch;
  totalSlots: number;
  occupiedOrReserved: number;
  level: OccupancyLevel;
}

export interface Reservation {
  id: string;
  userId: string;
  branchId: string;
  slotId: string;
  requestedType: SlotType;
  status: ReservationStatus;
  createdAt: string;
  expiresAt: string;
  confirmedAt: string | null;
}

export interface ParkingSession {
  id: string;
  reservationId: string;
  userId: string;
  slotId: string;
  status: SessionStatus;
  entryAt: string;
  exitAt: string | null;
}

export interface Payment {
  id: string;
  sessionId: string;
  userId: string;
  amount: number;
  status: PaymentStatus;
  externalReference: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface PricingBreakdownItem {
  label: string;
  amount: number;
}

export interface PricingResult {
  amount: number;
  currency: 'PEN';
  breakdown: PricingBreakdownItem[];
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

export interface CreateReservationCreated {
  outcome: 'CREATED';
  reservation: Reservation;
}

export interface CreateReservationSuggest {
  outcome: 'SUGGEST_OTHER_BRANCH';
  suggestedBranch: Branch;
  distanceKm: number;
}

export type CreateReservationResult = CreateReservationCreated | CreateReservationSuggest;

export interface RevenueReportRow {
  branch: Branch;
  totalRevenue: number;
}
