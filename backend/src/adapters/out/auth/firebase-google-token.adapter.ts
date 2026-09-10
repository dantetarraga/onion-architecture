import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { InvalidCredentialsError } from '../../../core/domain/errors/invalid-credentials.error';
import { GoogleIdentity, GoogleTokenVerifierPort } from '../../../core/ports/out/google-token-verifier.port';

/**
 * Claves publicas con las que Google firma los ID tokens de Firebase
 * Authentication (formato JWKS, RS256). Documentado por Google como
 * alternativa liviana a firebase-admin cuando solo se necesita *verificar*
 * tokens: no requiere credenciales de service account, solo el projectId
 * (dato publico, ya visible en la config web de Firebase).
 */
const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

@Injectable()
export class FirebaseGoogleTokenAdapter implements GoogleTokenVerifierPort {
  private readonly jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  private readonly projectId: string;

  constructor(private readonly config: ConfigService) {
    this.projectId = this.config.get<string>('FIREBASE_PROJECT_ID') ?? '';
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    if (!this.projectId) {
      throw new Error(
        'FIREBASE_PROJECT_ID no configurado: requerido para verificar login con Google.',
      );
    }

    let payload: Record<string, unknown>;
    try {
      const result = await jwtVerify(idToken, this.jwks, {
        issuer: `https://securetoken.google.com/${this.projectId}`,
        audience: this.projectId,
      });
      payload = result.payload;
    } catch {
      throw new InvalidCredentialsError('Token de Google invalido o expirado.');
    }

    const email = payload.email as string | undefined;
    if (!email) {
      throw new InvalidCredentialsError('El token de Google no incluye un correo.');
    }

    return {
      email,
      fullName: (payload.name as string | undefined) ?? email,
      emailVerified: Boolean(payload.email_verified),
    };
  }
}
