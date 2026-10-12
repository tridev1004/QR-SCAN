export interface PaymentQrCache {
  set(paymentSessionId: string, qrImage: string, expiresAt?: Date): Promise<void>;
  get(paymentSessionId: string): Promise<string | null>;
  delete(paymentSessionId: string): Promise<void>;
}
