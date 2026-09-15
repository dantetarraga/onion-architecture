/**
 * Contrato TOTP (RFC 6238), el algoritmo que usan Google Authenticator,
 * Microsoft Authenticator, Authy, etc. No hay red ni proveedor de por medio:
 * el backend y la app del usuario comparten un secreto y calculan el mismo
 * codigo de 6 digitos a partir de la hora actual (pasos de 30 segundos).
 */
export interface TotpPort {
  /** Secreto aleatorio nuevo, codificado en base32 (el formato que esperan las apps). */
  generateSecret(): string;
  /** URI `otpauth://totp/...` que el frontend renderiza como QR para escanear con la app. */
  buildOtpAuthUri(params: {
    secret: string;
    accountName: string;
    issuer: string;
  }): string;
  /**
   * Devuelve el time-step (contador de 30 s) contra el que el codigo resulto
   * valido, o null si no coincide con ningun step de la ventana tolerada.
   * Exponer el step permite al caso de uso rechazar la reutilizacion del
   * mismo codigo (anti-replay) sin que el adaptador tenga que guardar estado.
   */
  verify(secret: string, code: string): number | null;
}
