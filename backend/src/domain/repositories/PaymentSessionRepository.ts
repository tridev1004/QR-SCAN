import { PaymentListFilter, PaymentSession } from "../entities/PaymentSession";

export interface PaymentSessionRepository {
  create(session: PaymentSession): Promise<PaymentSession>;
  findById(id: string): Promise<PaymentSession | null>;
  findActiveByFingerprint(fingerprint: string): Promise<PaymentSession | null>;
  findByExternalSessionId(externalSessionId: string): Promise<PaymentSession | null>;
  update(session: PaymentSession): Promise<PaymentSession>;
  claimIfOpen(id: string, employeeId: string, now: Date): Promise<PaymentSession | null>;
  countActiveAssigned(employeeId: string): Promise<number>;
  releaseClaim(id: string, employeeId: string, now: Date): Promise<PaymentSession | null>;
  listOpenBroadcasts(): Promise<PaymentSession[]>;
  listForEmployee(employeeId: string): Promise<PaymentSession[]>;
  listAll(filter: PaymentListFilter): Promise<PaymentSession[]>;
  listPage(filter: PaymentListFilter, offset: number, limit: number): Promise<{ sessions: PaymentSession[]; total: number }>;
  countOutcomes(employeeId: string): Promise<{ passed: number; failed: number }>;
  consecutiveStrikes(employeeId: string, since: Date): Promise<number>;
  countSuccessGrouped(from?: Date): Promise<Array<{ employeeId: string; count: number }>>;
  countCreatorOutcomes(): Promise<Array<{ userId: string; passed: number; failed: number }>>;
  countTerminalInRange(from: Date, to: Date): Promise<{
    passed: number;
    failed: number;
    expired: number;
    passedByEmployee: Array<{ employeeId: string; count: number }>;
  }>;
  findDueForExpiry(now: Date): Promise<PaymentSession[]>;
  nextCode(): Promise<string>;
}
