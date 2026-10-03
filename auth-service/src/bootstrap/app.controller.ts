import { Controller, Get } from '@nestjs/common';

/** Health check HTTP simple; el trafico real de auth entra por gRPC (ver AuthGrpcController). */
@Controller()
export class AppController {
  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
