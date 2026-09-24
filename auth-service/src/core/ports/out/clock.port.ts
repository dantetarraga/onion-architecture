/** Abstrae `new Date()` para poder testear ventanas de tiempo (Politica 2) con reloj falso. */
export interface ClockPort {
  now(): Date;
}
