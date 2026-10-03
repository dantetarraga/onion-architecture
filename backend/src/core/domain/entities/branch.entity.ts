export interface BranchProps {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  pricePerHour: number;
  createdAt: Date;
}

export class Branch {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
  readonly pricePerHour: number;
  readonly createdAt: Date;

  constructor(props: BranchProps) {
    this.id = props.id;
    this.name = props.name;
    this.address = props.address;
    this.lat = props.lat;
    this.lng = props.lng;
    this.pricePerHour = props.pricePerHour;
    this.createdAt = props.createdAt;
  }

  /** Distancia aproximada en km via formula de Haversine, usada por SlotAssignmentPolicy. */
  distanceKmTo(other: Branch): number {
    const earthRadiusKm = 6371;
    const dLat = this.toRad(other.lat - this.lat);
    const dLng = this.toRad(other.lng - this.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(this.lat)) * Math.cos(this.toRad(other.lat)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}
