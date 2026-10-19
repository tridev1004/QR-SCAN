import { randomUUID } from "crypto";
import { PaymentListFilter, PaymentSession } from "../domain/entities/PaymentSession";
import { ACTIVE_STATUSES, PaymentStatus } from "../domain/enums/PaymentStatus";
import { ConflictError } from "../domain/errors/DomainError";
import { PaymentSessionRepository } from "../domain/repositories/PaymentSessionRepository";
import { isActive } from "../domain/services/PaymentStateMachine";

function isOpenBroadcast(session: PaymentSession): boolean {
  return session.broadcast === true && !session.assignedEmployeeId && isActive(session.status);
}

export class InMemoryPaymentSessionRepository implements PaymentSessionRepository {
  private readonly sessions = new Map<string, PaymentSession>();
  private seq = 0;

  async create(session: PaymentSession): Promise<PaymentSession> {
    const duplicateLocal = [...this.sessions.values()].some(
      (item) => item.externalSessionId && item.externalSessionId === session.externalSessionId,
    );
    const duplicateActive = [...this.sessions.values()].some(
      (item) => item.qrFingerprint === session.qrFingerprint && isActive(item.status),
    );
    if (duplicateLocal || duplicateActive) {
      throw new ConflictError("Payment session already exists");
    }
    this.sessions.set(session.id, session);
    return session;
  }

  async findById(id: string): Promise<PaymentSession | null> {
    return this.sessions.get(id) ?? null;
  }

  async findActiveByFingerprint(fingerprint: string): Promise<PaymentSession | null> {
    return (
      [...this.sessions.values()].find(
        (item) => item.qrFingerprint === fingerprint && isActive(item.status),
      ) ?? null
    );
  }

  async findByExternalSessionId(externalSessionId: string): Promise<PaymentSession | null> {
    return [...this.sessions.values()].find((item) => item.externalSessionId === externalSessionId) ?? null;
  }

  async update(session: PaymentSession): Promise<PaymentSession> {
    this.sessions.set(session.id, session);
    return session;
  }

  async claimIfOpen(id: string, employeeId: string, now: Date): Promise<PaymentSession | null> {
    const current = this.sessions.get(id);
    if (!current) {
      return null;
    }
    if (current.assignedEmployeeId === employeeId) {
      return current;
    }
    if (!isOpenBroadcast(current)) {
      return null;
    }
    const claimed: PaymentSession = {
      ...current,
      assignedEmployeeId: employeeId,
      broadcast: false,
      updatedAt: now,
    };
    this.sessions.set(id, claimed);
    return claimed;
  }

  async countActiveAssigned(employeeId: string): Promise<number> {
    return [...this.sessions.values()].filter(
      (item) => item.assignedEmployeeId === employeeId && isActive(item.status),
    ).length;
  }

  async releaseClaim(id: string, employeeId: string, now: Date): Promise<PaymentSession | null> {
    const current = this.sessions.get(id);
    if (!current || current.assignedEmployeeId !== employeeId || !isActive(current.status)) {
      return null;
    }
    const released: PaymentSession = { ...current, assignedEmployeeId: undefined, broadcast: true, updatedAt: now };
    this.sessions.set(id, released);
    return released;
  }

  async listOpenBroadcasts(): Promise<PaymentSession[]> {
    return [...this.sessions.values()]
      .filter((item) => isOpenBroadcast(item))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listForEmployee(employeeId: string): Promise<PaymentSession[]> {
    return [...this.sessions.values()]
      .filter((item) => item.assignedEmployeeId === employeeId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listAll(filter: PaymentListFilter): Promise<PaymentSession[]> {
    return this.matching(filter);
  }

  async listPage(
    filter: PaymentListFilter,
    offset: number,
    limit: number,
  ): Promise<{ sessions: PaymentSession[]; total: number }> {
    const sessions = this.matching(filter);
    return { sessions: sessions.slice(offset, offset + limit), total: sessions.length };
  }

  async countOutcomes(employeeId: string): Promise<{ passed: number; failed: number }> {
    const mine = [...this.sessions.values()].filter((item) => item.assignedEmployeeId === employeeId);
    return {
      passed: mine.filter((item) => item.status === PaymentStatus.SUCCESS).length,
      failed: mine.filter((item) => item.status === PaymentStatus.FAILED).length,
    };
  }

  async consecutiveStrikes(employeeId: string, since: Date): Promise<number> {
    const recent = [...this.sessions.values()]
      .filter(
        (item) =>
          item.assignedEmployeeId === employeeId &&
          (item.status === PaymentStatus.SUCCESS || item.status === PaymentStatus.FAILED || item.status === PaymentStatus.EXPIRED) &&
          item.completedAt !== undefined &&
          item.completedAt.getTime() > since.getTime(),
      )
      .sort((left, right) => (right.completedAt?.getTime() ?? 0) - (left.completedAt?.getTime() ?? 0))
      .slice(0, 2);
    let count = 0;
    for (const item of recent) {
      if (item.status !== PaymentStatus.FAILED && item.status !== PaymentStatus.EXPIRED) break;
      count += 1;
    }
    return count;
  }

  async countSuccessGrouped(from?: Date): Promise<Array<{ employeeId: string; count: number }>> {
    const counts = new Map<string, number>();
    for (const item of this.sessions.values()) {
      if (item.status !== PaymentStatus.SUCCESS || !item.assignedEmployeeId) continue;
      if (from && (!item.completedAt || item.completedAt.getTime() < from.getTime())) continue;
      counts.set(item.assignedEmployeeId, (counts.get(item.assignedEmployeeId) ?? 0) + 1);
    }
    return [...counts.entries()].map(([employeeId, count]) => ({ employeeId, count }));
  }

  async countFailedGrouped(): Promise<Array<{ employeeId: string; count: number }>> {
    const counts = new Map<string, number>();
    for (const item of this.sessions.values()) {
      if (item.status !== PaymentStatus.FAILED || !item.assignedEmployeeId) continue;
      counts.set(item.assignedEmployeeId, (counts.get(item.assignedEmployeeId) ?? 0) + 1);
    }
    return [...counts.entries()].map(([employeeId, count]) => ({ employeeId, count }));
  }

  async countCreatorOutcomes(from?: Date, to?: Date): Promise<Array<{ userId: string; passed: number; failed: number }>> {
    const counts = new Map<string, { passed: number; failed: number }>();
    for (const item of this.sessions.values()) {
      if (!item.createdByUserId) continue;
      if (item.status !== PaymentStatus.SUCCESS && item.status !== PaymentStatus.FAILED) continue;
      if (from && to) {
        if (!item.completedAt || item.completedAt.getTime() < from.getTime() || item.completedAt.getTime() >= to.getTime()) continue;
      }
      const current = counts.get(item.createdByUserId) ?? { passed: 0, failed: 0 };
      if (item.status === PaymentStatus.SUCCESS) current.passed += 1;
      if (item.status === PaymentStatus.FAILED) current.failed += 1;
      counts.set(item.createdByUserId, current);
    }
    return [...counts.entries()].map(([userId, count]) => ({ userId, ...count }));
  }

  async countCreatorPassedUncovered(
    userId: string,
    from: Date,
    to: Date,
    covered: Array<{ from: Date; to: Date }>,
  ): Promise<number> {
    return [...this.sessions.values()].filter((item) => {
      if (item.createdByUserId !== userId || item.status !== PaymentStatus.SUCCESS || !item.completedAt) return false;
      const at = item.completedAt.getTime();
      if (at < from.getTime() || at >= to.getTime()) return false;
      return !covered.some((span) => at >= span.from.getTime() && at < span.to.getTime());
    }).length;
  }

  async countTerminalInRange(from: Date, to: Date): Promise<{
    passed: number;
    failed: number;
    expired: number;
    passedByEmployee: Array<{ employeeId: string; count: number }>;
  }> {
    const inRange = [...this.sessions.values()].filter(
      (item) =>
        item.completedAt !== undefined &&
        item.completedAt.getTime() >= from.getTime() &&
        item.completedAt.getTime() < to.getTime(),
    );
    const passedByEmployee = new Map<string, number>();
    for (const item of inRange) {
      if (item.status === PaymentStatus.SUCCESS && item.assignedEmployeeId) {
        passedByEmployee.set(item.assignedEmployeeId, (passedByEmployee.get(item.assignedEmployeeId) ?? 0) + 1);
      }
    }
    return {
      passed: inRange.filter((item) => item.status === PaymentStatus.SUCCESS).length,
      failed: inRange.filter((item) => item.status === PaymentStatus.FAILED).length,
      expired: inRange.filter((item) => item.status === PaymentStatus.EXPIRED).length,
      passedByEmployee: [...passedByEmployee.entries()].map(([employeeId, count]) => ({ employeeId, count })),
    };
  }

  private matching(filter: PaymentListFilter): PaymentSession[] {
    return [...this.sessions.values()]
      .filter((item) => {
        if (filter.status && item.status !== filter.status) return false;
        if (filter.employeeId && item.assignedEmployeeId !== filter.employeeId) return false;
        if (filter.from && item.createdAt < filter.from) return false;
        if (filter.to && item.createdAt > filter.to) return false;
        if (filter.scope === "active" && !ACTIVE_STATUSES.includes(item.status)) return false;
        if (filter.scope === "expired" && item.status !== PaymentStatus.EXPIRED) return false;
        if (
          filter.scope === "finished" &&
          item.status !== PaymentStatus.SUCCESS &&
          item.status !== PaymentStatus.FAILED &&
          item.status !== PaymentStatus.EXPIRED
        ) {
          return false;
        }
        if (filter.q && !item.code.toLowerCase().includes(filter.q.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findDueForExpiry(now: Date): Promise<PaymentSession[]> {
    return [...this.sessions.values()].filter(
      (item) => isActive(item.status) && item.expiresAt !== undefined && item.expiresAt.getTime() <= now.getTime(),
    );
  }

  async nextCode(): Promise<string> {
    this.seq += 1;
    return `PAY-${String(this.seq).padStart(3, "0")}`;
  }
}

export function newId(): string {
  return randomUUID();
}
