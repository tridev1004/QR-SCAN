import { randomUUID } from "crypto";
import { PaymentListFilter, PaymentSession } from "../domain/entities/PaymentSession";
import { ACTIVE_STATUSES, PaymentStatus } from "../domain/enums/PaymentStatus";
import { ConflictError } from "../domain/errors/DomainError";
import { PaymentSessionRepository } from "../domain/repositories/PaymentSessionRepository";
import { isActive } from "../domain/services/PaymentStateMachine";

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

  async listForEmployee(employeeId: string): Promise<PaymentSession[]> {
    return [...this.sessions.values()]
      .filter((item) => item.assignedEmployeeId === employeeId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listAll(filter: PaymentListFilter): Promise<PaymentSession[]> {
    return [...this.sessions.values()]
      .filter((item) => {
        if (filter.status && item.status !== filter.status) return false;
        if (filter.employeeId && item.assignedEmployeeId !== filter.employeeId) return false;
        if (filter.from && item.createdAt < filter.from) return false;
        if (filter.to && item.createdAt > filter.to) return false;
        if (filter.scope === "active" && !ACTIVE_STATUSES.includes(item.status)) return false;
        if (filter.scope === "expired" && item.status !== PaymentStatus.EXPIRED) return false;
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
