import { PaymentQrCache } from "./PaymentQrCache";

interface Entry {
  qrImage: string;
  expiresAt?: Date;
}

export class MemoryPaymentQrCache implements PaymentQrCache {
  private readonly entries = new Map<string, Entry>();

  async set(paymentSessionId: string, qrImage: string, expiresAt?: Date): Promise<void> {
    this.entries.set(paymentSessionId, { qrImage, expiresAt });
  }

  async get(paymentSessionId: string): Promise<string | null> {
    const entry = this.entries.get(paymentSessionId);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt && entry.expiresAt.getTime() <= Date.now()) {
      this.entries.delete(paymentSessionId);
      return null;
    }
    return entry.qrImage;
  }

  async delete(paymentSessionId: string): Promise<void> {
    this.entries.delete(paymentSessionId);
  }
}
