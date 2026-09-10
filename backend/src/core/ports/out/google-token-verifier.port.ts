export interface GoogleIdentity {
  email: string;
  fullName: string;
  emailVerified: boolean;
}

/**
 * Verifica un ID token de Google/Firebase y devuelve la identidad que certifica.
 * Puerto especifico de este proveedor: a proposito NO se generaliza a un
 * "SocialAuthPort" comun con otros proveedores (p.ej. Facebook, en desarrollo
 * en paralelo por otro integrante) para no forzar una abstraccion compartida
 * antes de tiempo. Unificar login social, si hace falta, es un refactor
 * deliberado posterior.
 */
export interface GoogleTokenVerifierPort {
  verify(idToken: string): Promise<GoogleIdentity>;
}
