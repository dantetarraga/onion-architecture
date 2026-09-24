import { Role } from '../enums/role.enum';

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: Role;
  /** true cuando el usuario confirmo su app TOTP; el secreto NO vive en la entidad (ver MfaCredentials). */
  mfaEnabled: boolean;
  createdAt: Date;
}

export class User {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly fullName: string;
  readonly role: Role;
  readonly mfaEnabled: boolean;
  readonly createdAt: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.fullName = props.fullName;
    this.role = props.role;
    this.mfaEnabled = props.mfaEnabled;
    this.createdAt = props.createdAt;
  }

  isAdmin(): boolean {
    return this.role === Role.ADMIN;
  }
}
