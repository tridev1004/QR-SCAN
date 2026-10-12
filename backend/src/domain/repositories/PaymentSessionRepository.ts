import { PaymentListFilter, PaymentSession } from "../entities/PaymentSession";

export interface PaymentSessionRepository {
  create(session: PaymentSession): Promise<PaymentSession>;
  findById(id: string): Promise<PaymentSession | null>;
  findActiveByFingerprint(fingerprint: string): Promise<PaymentSession | null>;
  findByExternalSessionId(externalSessionId: string): Promise<PaymentSession | null>;
  update(session: PaymentSession): Promise<PaymentSession>;
  listForEmployee(employeeId: string): Promise<PaymentSession[]>;
  listAll(filter: PaymentListFilter): Promise<PaymentSession[]>;
  findDueForExpiry(now: Date): Promise<PaymentSession[]>;
  nextCode(): Promise<string>;
}
