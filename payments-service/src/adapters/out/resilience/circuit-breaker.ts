/**
 * Circuit Breaker minimo (sin dependencias) para llamadas a otro servicio.
 *
 * - CLOSED: las llamadas pasan; cada fallo de infraestructura suma. Al llegar
 *   a `failureThreshold` fallos consecutivos el circuito se ABRE.
 * - OPEN: se rechaza al instante con CircuitOpenError (fail fast), sin tocar
 *   la red, durante `resetTimeoutMs`. Asi un servicio caido no deja colgados
 *   los requests de quien lo llama ni recibe una avalancha mientras se levanta.
 * - HALF_OPEN: pasado ese tiempo se deja pasar UNA llamada de prueba; si sale
 *   bien se cierra, si falla se vuelve a abrir.
 *
 * `isFailure` decide que cuenta como fallo: los errores de dominio que
 * devuelve el otro servicio (NOT_FOUND, INVALID_CREDENTIALS...) son respuestas
 * validas de un servicio sano y NO deben abrir el circuito.
 *
 * Copia identica en gateway, backend y payments-service: los microservicios
 * no comparten codigo, solo contratos.
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Nombre del destino, para logs y metricas (p. ej. `auth-service`). */
  name: string;
  failureThreshold?: number;
  resetTimeoutMs?: number;
  isFailure?: (error: unknown) => boolean;
  onStateChange?: (name: string, state: CircuitState) => void;
  onReject?: (name: string) => void;
}

export class CircuitOpenError extends Error {
  constructor(readonly target: string) {
    super(`Circuito abierto hacia ${target}: se rechaza sin llamar.`);
    this.name = 'CircuitOpenError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt = 0;
  private probeInFlight = false;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly isFailure: (error: unknown) => boolean;

  constructor(private readonly options: CircuitBreakerOptions) {
    this.failureThreshold =
      options.failureThreshold ?? envInt('CIRCUIT_BREAKER_FAILURE_THRESHOLD', 5);
    this.resetTimeoutMs =
      options.resetTimeoutMs ?? envInt('CIRCUIT_BREAKER_RESET_TIMEOUT_MS', 10_000);
    this.isFailure = options.isFailure ?? (() => true);
    options.onStateChange?.(options.name, this.state);
  }

  get currentState(): CircuitState {
    return this.state;
  }

  async execute<T>(action: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt < this.resetTimeoutMs) {
        return this.reject();
      }
      this.transition('HALF_OPEN');
    }
    if (this.state === 'HALF_OPEN') {
      if (this.probeInFlight) {
        return this.reject();
      }
      this.probeInFlight = true;
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (error) {
      if (this.isFailure(error)) {
        this.onFailure();
      } else {
        // Error de dominio: el servicio respondio, esta sano.
        this.onSuccess();
      }
      throw error;
    } finally {
      this.probeInFlight = false;
    }
  }

  private reject(): never {
    this.options.onReject?.(this.options.name);
    throw new CircuitOpenError(this.options.name);
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.state !== 'CLOSED') {
      this.transition('CLOSED');
    }
  }

  private onFailure(): void {
    this.consecutiveFailures += 1;
    if (
      this.state === 'HALF_OPEN' ||
      this.consecutiveFailures >= this.failureThreshold
    ) {
      this.openedAt = Date.now();
      this.transition('OPEN');
    }
  }

  private transition(next: CircuitState): void {
    if (this.state === next) {
      return;
    }
    this.state = next;
    this.options.onStateChange?.(this.options.name, next);
  }
}

function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
