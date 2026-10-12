import mongoose, { Model, Schema } from "mongoose";
import { PaymentQrCache } from "./PaymentQrCache";

interface QrCacheDocument {
  _id: string;
  qrImage: string;
  expiresAt?: Date;
}

const qrCacheSchema = new Schema<QrCacheDocument>(
  {
    _id: { type: String, required: true },
    qrImage: { type: String, required: true },
    expiresAt: { type: Date },
  },
  { versionKey: false },
);

const QrCacheModel: Model<QrCacheDocument> =
  (mongoose.models.PaymentQrCache as Model<QrCacheDocument> | undefined) ??
  mongoose.model<QrCacheDocument>("PaymentQrCache", qrCacheSchema);

export class MongoPaymentQrCache implements PaymentQrCache {
  async set(paymentSessionId: string, qrImage: string, expiresAt?: Date): Promise<void> {
    await QrCacheModel.findByIdAndUpdate(
      paymentSessionId,
      { qrImage, expiresAt },
      { upsert: true, new: true },
    );
  }

  async get(paymentSessionId: string): Promise<string | null> {
    const doc = await QrCacheModel.findById(paymentSessionId).lean();
    if (!doc) {
      return null;
    }
    if (doc.expiresAt && doc.expiresAt.getTime() <= Date.now()) {
      await QrCacheModel.findByIdAndDelete(paymentSessionId);
      return null;
    }
    return doc.qrImage;
  }

  async delete(paymentSessionId: string): Promise<void> {
    await QrCacheModel.findByIdAndDelete(paymentSessionId);
  }
}
