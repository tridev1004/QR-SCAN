export enum PaymentStatus {
  DETECTED = "DETECTED",
  QR_READY = "QR_READY",
  WAITING_FOR_PAYMENT = "WAITING_FOR_PAYMENT",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
}

export const TERMINAL_STATUSES: readonly PaymentStatus[] = [
  PaymentStatus.SUCCESS,
  PaymentStatus.FAILED,
  PaymentStatus.EXPIRED,
];

export const ACTIVE_STATUSES: readonly PaymentStatus[] = [
  PaymentStatus.DETECTED,
  PaymentStatus.QR_READY,
  PaymentStatus.WAITING_FOR_PAYMENT,
];
