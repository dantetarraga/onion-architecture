import { User } from '../entities/user.entity';
import { Role } from '../enums/role.enum';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  fullName: string;
  role: Role;
}

export interface UserRepositoryPort {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
}
