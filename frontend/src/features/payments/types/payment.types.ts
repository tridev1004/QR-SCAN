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
  cooldownUntil?: string;
  hasPayoutQr?: boolean;
}

export interface EmployeeEarnings {
  successRewardInr: number;
  passedCount: number;
  failedCount: number;
  earnedInr: number;
  todayPassedCount?: number;
  todayEarnedInr?: number;
  paidInr?: number;
  unpaidInr?: number;
  hasPayoutQr?: boolean;
}

export interface EmployeePayoutRow {
  id: string;
  name: string;
  email: string;
  active: boolean;
  cooldownUntil?: string;
  successRewardInr: number;
  todayPassed: number;
  overallPassed: number;
  earnedInr: number;
  paidInr: number;
  unpaidInr: number;
  hasPayoutQr: boolean;
  upiId?: string;
  lastPaidAt?: string;
}

export interface PayoutReport {
  todayPassed: number;
  overallPassed: number;
  totalPayableInr: number;
  employees: EmployeePayoutRow[];
  total: number;
  hasMore: boolean;
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
  | { type: "payment-assigned"; data: PaymentSession }
  | { type: "payout-updated"; data: { employeeId: string; paidInr: number; unpaidInr: number; earnedInr: number } }
  | { type: "pause-cleared"; data: { employeeId: string } }
  | {
      type: "broadcast";
      data: { id: string; message: string; createdAt: string; expiresAt: string; active: boolean };
    };

export interface BroadcastNotice {
  id: string;
  message: string;
  createdAt: string;
  expiresAt: string;
}

export function isTerminal(status: PaymentStatus): boolean {
  return status === "SUCCESS" || status === "FAILED" || status === "EXPIRED";
}
