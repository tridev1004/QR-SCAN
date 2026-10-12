import { User } from "../entities/User";
import { UserRole } from "../enums/UserRole";

export interface UserPage {
  users: User[];
  total: number;
  activeCount: number;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByVerificationTokenHash(tokenHash: string): Promise<User | null>;
  listByRole(role: UserRole): Promise<User[]>;
  listByRolePage(role: UserRole, offset: number, limit: number): Promise<UserPage>;
  create(user: User): Promise<User>;
  update(user: User): Promise<User>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
}
