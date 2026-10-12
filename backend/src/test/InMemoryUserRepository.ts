import { User } from "../domain/entities/User";
import { UserRole } from "../domain/enums/UserRole";
import { UserPage, UserRepository } from "../domain/repositories/UserRepository";

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  constructor(seed: User[] = []) {
    for (const user of seed) {
      this.users.set(user.id, user);
    }
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return [...this.users.values()].find((user) => user.email === email.toLowerCase()) ?? null;
  }

  async findByVerificationTokenHash(tokenHash: string): Promise<User | null> {
    return [...this.users.values()].find((user) => user.verificationTokenHash === tokenHash) ?? null;
  }

  async listByRole(role: UserRole): Promise<User[]> {
    return this.sortedByRole(role);
  }

  async listByRolePage(role: UserRole, offset: number, limit: number): Promise<UserPage> {
    const users = this.sortedByRole(role);
    return {
      users: users.slice(offset, offset + limit),
      total: users.length,
      activeCount: users.filter((user) => user.active).length,
    };
  }

  private sortedByRole(role: UserRole): User[] {
    return [...this.users.values()]
      .filter((user) => user.role === role)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  async create(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async update(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }

  async count(): Promise<number> {
    return this.users.size;
  }
}
