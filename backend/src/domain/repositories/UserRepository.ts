import { User } from "../entities/User";
import { UserRole } from "../enums/UserRole";

export interface UserPage {
  users: User[];
  total: number;
  activeCount: number;
}

export interface EmployeePayoutSource {
  id: string;
  name: string;
  email: string;
  active: boolean;
  successRewardInr: number;
  paidInr: number;
  hasPayoutQr: boolean;
  upiId?: string;
  cooldownUntil?: Date;
  lastPaidAt?: Date;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByVerificationTokenHash(tokenHash: string): Promise<User | null>;
  listByRole(role: UserRole): Promise<User[]>;
  listByRolePage(role: UserRole, offset: number, limit: number, q?: string): Promise<UserPage>;
  listEmployeePayoutSources(): Promise<EmployeePayoutSource[]>;
  create(user: User): Promise<User>;
  update(user: User): Promise<User>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
  setPayoutQr(id: string, image: string | null): Promise<void>;
  getPayoutQr(id: string): Promise<string | null>;
}
