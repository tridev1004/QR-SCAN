export type PaymentStatus =
  | "DETECTED"
  | "QR_READY"
  | "WAITING_FOR_PAYMENT"
  | "SUCCESS"
  | "FAILED"
  | "EXPIRED";

export interface TrackedSession {
  localSessionId: string;
  backendPaymentSessionId: string;
  qrFingerprint: string;
  status: PaymentStatus;
  expiresAt?: string;
}

export function isTerminalStatus(status: PaymentStatus): boolean {
  return status === "SUCCESS" || status === "FAILED" || status === "EXPIRED";
}
