import type {
  OccupancyLevel,
  PaymentStatus,
  ReservationStatus,
  Role,
  SessionStatus,
  SlotType,
} from "./enums";

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
  startAt: string;
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
  currency: "PEN";
  breakdown: PricingBreakdownItem[];
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  /** Verificacion en dos pasos (TOTP) activa. Lo devuelve GET /users/me; el login no lo incluye. */
  mfaEnabled?: boolean;
}

/**
 * Respuesta de POST /reservations: la solicitud entra a la cola de RabbitMQ
 * y el backend responde 202 de inmediato. El desenlace llega despues por
 * WebSocket en `reservation.request.resolved`, correlacionado por requestId.
 */
export interface ReservationRequestAccepted {
  requestId: string;
  status: "QUEUED";
}

export interface ReservationRequestResolved {
  requestId: string;
  userId: string;
  status: "CREATED" | "SUGGEST_OTHER_BRANCH" | "REJECTED";
  reservation?: {
    id: string;
    branchId: string;
    slotId: string;
    startAt: string;
    expiresAt: string;
  };
  suggestedBranch?: { id: string; name: string; address: string };
  distanceKm?: number;
  code?: string;
  message?: string;
}

export interface RevenueReportRow {
  branch: Branch;
  totalRevenue: number;
}
