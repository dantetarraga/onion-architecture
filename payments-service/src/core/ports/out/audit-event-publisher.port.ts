export interface AuditEventPublisherPort {
  publishPaymentRegistered(event: {
    paymentId: string;
    sessionId: string;
    branchId: string;
    userId: string;
    amount: number;
    status: string;
    occurredAt: string;
  }): Promise<void>;
}