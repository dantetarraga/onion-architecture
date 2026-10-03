export interface ReportSlotBlockedPort {
  execute(slotId: string): Promise<void>;
}
