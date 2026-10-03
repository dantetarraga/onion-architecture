import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../../core/ports/out/clock.port';

@Injectable()
export class SystemClockAdapter implements ClockPort {
  now(): Date {
    return new Date();
  }
}
