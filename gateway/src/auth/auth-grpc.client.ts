import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { AUTH_GRPC_CLIENT } from './auth-grpc.tokens';

export interface AuthenticatedUserSummary {
  id: string;
  email: string;
  fullName: string;
  role: string;
}
export interface UserReply extends AuthenticatedUserSummary {
  mfaEnabled: boolean;
  createdAt: string;
}
export interface LoginReply {
  fullSession?: { accessToken: string; user: AuthenticatedUserSummary };
  mfaChallenge?: { mfaToken: string };
}

/** Shape original de LoginUserResult (backend/core/application/use-cases/auth/issue-session.ts). */
export type LoginUserResult =
  | { mfaRequired: false; accessToken: string; user: AuthenticatedUserSummary }
  | { mfaRequired: true; mfaToken: string };

/**
 * El proto modela la union con `oneof` (fullSession/mfaChallenge) porque asi
 * es como gRPC expresa "uno de estos dos", pero el frontend nunca vio ese
 * shape: siempre recibio {mfaRequired, ...} plano. Aplanar aqui evita tocar
 * el frontend, que es el objetivo de todo el gateway.
 */
export function toLoginResult(reply: LoginReply): LoginUserResult {
  if (reply.fullSession) {
    return {
      mfaRequired: false,
      accessToken: reply.fullSession.accessToken,
      user: reply.fullSession.user,
    };
  }
  if (reply.mfaChallenge) {
    return { mfaRequired: true, mfaToken: reply.mfaChallenge.mfaToken };
  }
  throw new Error('LoginReply de auth-service sin fullSession ni mfaChallenge.');
}
export interface SetupMfaReply {
  secret: string;
  otpauthUri: string;
}
export interface ConfirmMfaReply {
  backupCodes: string[];
}

interface AuthServiceGrpc {
  register(data: {
    email: string;
    password: string;
    fullName: string;
  }): Observable<UserReply>;
  login(data: { email: string; password: string }): Observable<LoginReply>;
  loginWithGoogle(data: { idToken: string }): Observable<LoginReply>;
  loginWithFacebook(data: { accessToken: string }): Observable<LoginReply>;
  verifyMfa(data: { mfaToken: string; code: string }): Observable<LoginReply>;
  setupMfa(data: { userId: string }): Observable<SetupMfaReply>;
  confirmMfa(data: { userId: string; code: string }): Observable<ConfirmMfaReply>;
  disableMfa(data: { userId: string; code: string }): Observable<Record<string, never>>;
  getUserById(data: { userId: string }): Observable<UserReply>;
}

@Injectable()
export class AuthGrpcClient implements OnModuleInit {
  private service!: AuthServiceGrpc;

  constructor(@Inject(AUTH_GRPC_CLIENT) private readonly grpc: ClientGrpc) {}

  onModuleInit(): void {
    this.service = this.grpc.getService<AuthServiceGrpc>('AuthService');
  }

  get auth(): AuthServiceGrpc {
    return this.service;
  }
}
