import { PaymentStatus } from "../types/payment.types";

const LABELS: Record<PaymentStatus, string> = {
  DETECTED: "Detected",
  QR_READY: "QR ready",
  WAITING_FOR_PAYMENT: "Waiting",
  SUCCESS: "Success",
  FAILED: "Failed",
  EXPIRED: "Expired",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{LABELS[status]}</span>;
}
