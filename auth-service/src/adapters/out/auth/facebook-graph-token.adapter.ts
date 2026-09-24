import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { InvalidCredentialsError } from '../../../core/domain/errors/invalid-credentials.error';
import {
  FacebookIdentity,
  FacebookTokenVerifierPort,
} from '../../../core/ports/out/facebook-token-verifier.port';

const GRAPH_BASE = 'https://graph.facebook.com';
const DEFAULT_GRAPH_VERSION = 'v21.0';

interface DebugTokenData {
  app_id?: string;
  is_valid?: boolean;
  expires_at?: number;
  user_id?: string;
}

interface GraphMe {
  id?: string;
  name?: string;
  email?: string;
}

@Injectable()
export class FacebookGraphTokenAdapter implements FacebookTokenVerifierPort {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly version: string;

  constructor(private readonly config: ConfigService) {
    this.appId = this.config.get<string>('FACEBOOK_APP_ID') ?? '';
    this.appSecret = this.config.get<string>('FACEBOOK_APP_SECRET') ?? '';
    this.version =
      this.config.get<string>('FACEBOOK_GRAPH_VERSION') ??
      DEFAULT_GRAPH_VERSION;
  }

  async verify(accessToken: string): Promise<FacebookIdentity> {
    if (!this.appId || !this.appSecret) {
      throw new Error(
        'FACEBOOK_APP_ID / FACEBOOK_APP_SECRET no configurados: requeridos para verificar login con Facebook.',
      );
    }

    await this.assertTokenBelongsToThisApp(accessToken);
    return this.fetchIdentity(accessToken);
  }

  private async assertTokenBelongsToThisApp(
    accessToken: string,
  ): Promise<void> {
    const url = new URL(`${GRAPH_BASE}/${this.version}/debug_token`);
    url.searchParams.set('input_token', accessToken);
    url.searchParams.set('access_token', `${this.appId}|${this.appSecret}`);

    const body = await this.getJson<{ data?: DebugTokenData }>(url);
    const data = body.data;

    if (!data?.is_valid) {
      throw new InvalidCredentialsError(
        'Token de Facebook invalido o expirado.',
      );
    }
    if (data.app_id !== this.appId) {
      throw new InvalidCredentialsError(
        'El token de Facebook pertenece a otra aplicacion.',
      );
    }
    if (data.expires_at && data.expires_at * 1000 <= Date.now()) {
      throw new InvalidCredentialsError(
        'Token de Facebook invalido o expirado.',
      );
    }
  }

  private async fetchIdentity(accessToken: string): Promise<FacebookIdentity> {
    const url = new URL(`${GRAPH_BASE}/${this.version}/me`);
    url.searchParams.set('fields', 'id,name,email');
    url.searchParams.set('access_token', accessToken);
    url.searchParams.set('appsecret_proof', this.appSecretProof(accessToken));

    const me = await this.getJson<GraphMe>(url);

    if (!me.email) {
      throw new InvalidCredentialsError(
        'Tu cuenta de Facebook no tiene un correo disponible. Concede el permiso de correo o usa otro metodo.',
      );
    }

    return {
      email: me.email,
      fullName: me.name ?? me.email,
      facebookUserId: me.id ?? '',
    };
  }

  private appSecretProof(accessToken: string): string {
    return createHmac('sha256', this.appSecret)
      .update(accessToken)
      .digest('hex');
  }

  private async getJson<T>(url: URL): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      throw new InvalidCredentialsError(
        'No se pudo verificar el token de Facebook.',
      );
    }

    if (!response.ok) {
      throw new InvalidCredentialsError(
        'Token de Facebook invalido o expirado.',
      );
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new InvalidCredentialsError(
        'No se pudo verificar el token de Facebook.',
      );
    }
  }
}
