/**
 * Lectura de datos de usuario ajena al dominio de este servicio: User vive
 * en auth-service desde la extraccion del microservicio de autenticacion.
 * Puerto deliberadamente angosto (solo lo que CreateReservationUseCase
 * necesita para el evento de confirmacion por correo) en vez de reintroducir
 * un UserRepositoryPort completo.
 */
export interface UserLookupResult {
  id: string;
  email: string;
  fullName: string;
}

export interface UserLookupPort {
  findById(userId: string): Promise<UserLookupResult | null>;
}
