import type { SessionQuote } from '../../../application/use-cases/parking/get-session-quote.use-case';

export interface GetSessionQuotePort {
  execute(sessionId: string): Promise<SessionQuote>;
}
