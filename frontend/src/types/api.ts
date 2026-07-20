export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

const CODE_MESSAGES: Record<string, string> = {
  RESERVATION_ALREADY_ACTIVE: 'Ya tienes una reserva o sesión activa. Debes cerrarla antes de crear otra.',
  NO_AVAILABILITY: 'No hay cocheras disponibles en esta sucursal ni en sucursales cercanas.',
  SLOT_NOT_AVAILABLE: 'Esa cochera ya no está disponible.',
  SESSION_NOT_ACTIVE: 'La sesión ya no está activa.',
  PAYMENT_NOT_APPROVED: 'Debes completar el pago antes de registrar la salida.',
  RESERVATION_EXPIRED: 'La reserva expiró.',
  NOT_FOUND: 'No se encontró el recurso solicitado.',
  INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
  EMAIL_ALREADY_REGISTERED: 'Ese correo ya está registrado.',
  INVALID_QR_CODE: 'Código QR inválido o expirado.',
};

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(body: ApiErrorBody) {
    super(CODE_MESSAGES[body.code] ?? body.message ?? 'Ocurrió un error inesperado.');
    this.code = body.code;
    this.status = body.statusCode;
    this.name = 'ApiError';
  }
}
