/** Injected time source. Services must never call Date.now() directly. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Deterministic clock for tests: starts at `start`, advances `stepMs` per call. */
export function fixedClock(start: string | Date, stepMs = 0): Clock {
  let t = new Date(start).getTime();
  return {
    now() {
      const d = new Date(t);
      t += stepMs;
      return d;
    },
  };
}

/** Injected ID generator. */
export interface IdGenerator {
  next(): string;
}

export function sequentialIds(prefix = 'id'): IdGenerator {
  let n = 0;
  return { next: () => `${prefix}-${String(++n).padStart(6, '0')}` };
}

export function randomIds(): IdGenerator {
  return { next: () => globalThis.crypto.randomUUID() };
}
