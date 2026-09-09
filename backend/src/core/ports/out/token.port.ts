import { Role } from '../../domain/enums/role.enum';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface TokenPort {
  sign(payload: AuthTokenPayload): Promise<string>;
  verify(token: string): Promise<AuthTokenPayload>;
}
