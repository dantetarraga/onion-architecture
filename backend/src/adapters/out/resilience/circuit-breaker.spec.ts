import {
  CircuitBreaker,
  CircuitOpenError,
  type CircuitState,
} from './circuit-breaker';

const fail = () => Promise.reject(new Error('UNAVAILABLE'));
const ok = () => Promise.resolve('ok');

function build(overrides: Partial<ConstructorParameters<typeof CircuitBreaker>[0]> = {}) {
  const states: CircuitState[] = [];
  const breaker = new CircuitBreaker({
    name: 'target',
    failureThreshold: 3,
    resetTimeoutMs: 1000,
    onStateChange: (_, state) => states.push(state),
    ...overrides,
  });
  return { breaker, states };
}

describe('CircuitBreaker', () => {
  afterEach(() => jest.useRealTimers());

  it('se abre tras N fallos consecutivos y rechaza sin ejecutar la accion', async () => {
    const { breaker } = build();
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fail)).rejects.toThrow('UNAVAILABLE');
    }
    expect(breaker.currentState).toBe('OPEN');

    const action = jest.fn(ok);
    await expect(breaker.execute(action)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(action).not.toHaveBeenCalled();
  });

  it('un exito reinicia el contador de fallos consecutivos', async () => {
    const { breaker } = build();
    await expect(breaker.execute(fail)).rejects.toThrow();
    await expect(breaker.execute(fail)).rejects.toThrow();
    await breaker.execute(ok);
    await expect(breaker.execute(fail)).rejects.toThrow();
    expect(breaker.currentState).toBe('CLOSED');
  });

  it('los errores de dominio no abren el circuito', async () => {
    const { breaker } = build({ isFailure: () => false });
    for (let i = 0; i < 5; i++) {
      await expect(breaker.execute(fail)).rejects.toThrow('UNAVAILABLE');
    }
    expect(breaker.currentState).toBe('CLOSED');
  });

  it('pasado el reset deja pasar una prueba (HALF_OPEN) y se cierra si sale bien', async () => {
    jest.useFakeTimers();
    const { breaker, states } = build();
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fail)).rejects.toThrow();
    }
    jest.advanceTimersByTime(1000);

    await expect(breaker.execute(ok)).resolves.toBe('ok');
    expect(breaker.currentState).toBe('CLOSED');
    expect(states).toEqual(['CLOSED', 'OPEN', 'HALF_OPEN', 'CLOSED']);
  });

  it('si la prueba en HALF_OPEN falla, vuelve a OPEN', async () => {
    jest.useFakeTimers();
    const { breaker } = build();
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fail)).rejects.toThrow();
    }
    jest.advanceTimersByTime(1000);

    await expect(breaker.execute(fail)).rejects.toThrow('UNAVAILABLE');
    expect(breaker.currentState).toBe('OPEN');
  });

  it('en HALF_OPEN solo deja pasar una llamada a la vez', async () => {
    jest.useFakeTimers();
    const onReject = jest.fn();
    const { breaker } = build({ onReject });
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fail)).rejects.toThrow();
    }
    jest.advanceTimersByTime(1000);

    let release!: (value: string) => void;
    const probe = breaker.execute(() => new Promise<string>((r) => (release = r)));
    await expect(breaker.execute(ok)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(onReject).toHaveBeenCalledWith('target');

    release('ok');
    await expect(probe).resolves.toBe('ok');
    expect(breaker.currentState).toBe('CLOSED');
  });
});
