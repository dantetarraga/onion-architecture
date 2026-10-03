import { Role } from './role.enum';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: Role;
}
