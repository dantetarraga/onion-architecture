import type { GenerateEntryQrInput } from '../../../application/use-cases/parking/generate-entry-qr.use-case';

export interface GenerateEntryQrPort {
  execute(input: GenerateEntryQrInput): Promise<{ qrPayload: string }>;
}
