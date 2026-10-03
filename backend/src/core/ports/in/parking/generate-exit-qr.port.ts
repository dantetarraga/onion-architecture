import type { GenerateExitQrInput } from '../../../application/use-cases/parking/generate-exit-qr.use-case';

export interface GenerateExitQrPort {
  execute(input: GenerateExitQrInput): Promise<{ qrPayload: string }>;
}
