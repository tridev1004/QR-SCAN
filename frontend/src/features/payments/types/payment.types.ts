export type PaymentStatus =
  | "DETECTED"
  | "QR_READY"
  | "WAITING_FOR_PAYMENT"
  | "SUCCESS"
  | "FAILED"
  | "EXPIRED";

export interface PaymentHistoryEntry {
  status: PaymentStatus;
  at: string;
  message?: string;
}

export interface PaymentSession {
  id: string;
  code: string;
  status: PaymentStatus;
  assignedEmployeeId?: string;
  broadcast?: boolean;
  createdByUserId?: string;
  amount?: number;
  currency?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
  history: PaymentHistoryEntry[];
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  active: boolean;
  successRewardInr: number;
}

export interface EmployeeEarnings {
  successRewardInr: number;
  passedCount: number;
  failedCount: number;
  earnedInr: number;
}

export type PaymentStreamEvent =
  | { type: "payment-created"; data: PaymentSession }
  | {
      type: "payment-status";
      data: {
        paymentSessionId: string;
        status: PaymentStatus;
        errorMessage?: string;
        completedAt?: string;
        assignedEmployeeId?: string;
      };
    }
  | { type: "payment-assigned"; data: PaymentSession };

export function isTerminal(status: PaymentStatus): boolean {
  return status === "SUCCESS" || status === "FAILED" || status === "EXPIRED";
}
