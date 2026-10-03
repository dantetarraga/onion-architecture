export interface QrPayload {
  type: 'ENTRY' | 'EXIT';
  reservationId?: string;
  sessionId?: string;
  expiresAt: number;
}

export interface QrCodePort {
  signEntryToken(reservationId: string): string;
  signExitToken(sessionId: string): string;
  verify(token: string): QrPayload;
}
