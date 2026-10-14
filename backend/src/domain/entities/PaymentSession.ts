import { PaymentStatus } from "../enums/PaymentStatus";

export interface PaymentHistoryEntry {
  status: PaymentStatus;
  at: Date;
  message?: string;
}

export interface PaymentSession {
  id: string;
  code: string;
  externalSessionId?: string;
  qrFingerprint: string;
  assignedEmployeeId?: string;
  broadcast?: boolean;
  createdByUserId?: string;
  status: PaymentStatus;
  amount?: number;
  currency?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  lastSeenAt?: Date;
  history: PaymentHistoryEntry[];
}

export interface PaymentListFilter {
  status?: PaymentStatus;
  employeeId?: string;
  from?: Date;
  to?: Date;
  scope?: "active" | "expired" | "finished" | "all";
  q?: string;
}
