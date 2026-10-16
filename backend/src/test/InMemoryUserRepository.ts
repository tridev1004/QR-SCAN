import { User } from "../domain/entities/User";
import { UserRole } from "../domain/enums/UserRole";
import { EmployeePayoutSource, UserPage, UserRepository } from "../domain/repositories/UserRepository";

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();
  private readonly payoutQrs = new Map<string, string>();

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

  async listEmployeePayoutSources(): Promise<EmployeePayoutSource[]> {
    return this.sortedByRole(UserRole.EMPLOYEE).map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      active: user.active,
      successRewardInr: user.successRewardInr ?? 0,
      paidInr: user.paidInr ?? 0,
      hasPayoutQr: user.hasPayoutQr === true,
      upiId: user.upiId,
      cooldownUntil: user.cooldownUntil,
      lastPaidAt: user.payouts?.at(-1)?.paidAt,
    }));
  }

  async sumPayoutsBetween(from: Date, to: Date): Promise<number> {
    let paid = 0;
    for (const user of this.users.values()) {
      if (user.role !== UserRole.EMPLOYEE) continue;
      for (const entry of user.payouts ?? []) {
        const at = entry.paidAt.getTime();
        if (at >= from.getTime() && at < to.getTime()) paid += entry.amountInr;
      }
    }
    return paid;
  }

  async listByRolePage(role: UserRole, offset: number, limit: number, q?: string): Promise<UserPage> {
    const users = this.sortedByRole(role, q);
    return {
      users: users.slice(offset, offset + limit),
      total: users.length,
      activeCount: users.filter((user) => user.active).length,
    };
  }

  private sortedByRole(role: UserRole, q?: string): User[] {
    const needle = q?.trim().toLowerCase();
    return [...this.users.values()]
      .filter((user) => user.role === role)
      .filter((user) => !needle || user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle))
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

  async setPayoutQr(id: string, image: string | null): Promise<void> {
    const user = this.users.get(id);
    if (!user) return;
    if (image) this.payoutQrs.set(id, image);
    else this.payoutQrs.delete(id);
    this.users.set(id, { ...user, hasPayoutQr: Boolean(image) });
  }

  async getPayoutQr(id: string): Promise<string | null> {
    return this.payoutQrs.get(id) ?? null;
  }
}
