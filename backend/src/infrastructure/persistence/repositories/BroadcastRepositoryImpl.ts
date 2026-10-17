import mongoose, { Model, Schema } from "mongoose";
import { BroadcastRecord, BroadcastRepository } from "../../../domain/repositories/BroadcastRepository";

interface BroadcastDocument {
  _id: string;
  message: string;
  createdAt: Date;
  expiresAt: Date;
  createdByUserId: string;
}

const broadcastSchema = new Schema<BroadcastDocument>(
  {
    _id: { type: String, required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
    createdByUserId: { type: String, required: true },
  },
  { versionKey: false },
);

const BroadcastModel: Model<BroadcastDocument> =
  mongoose.models.Broadcast ?? mongoose.model<BroadcastDocument>("Broadcast", broadcastSchema);

function toRecord(doc: BroadcastDocument): BroadcastRecord {
  return {
    id: doc._id,
    message: doc.message,
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt,
    createdByUserId: doc.createdByUserId,
  };
}

export class BroadcastRepositoryImpl implements BroadcastRepository {
  async create(record: BroadcastRecord): Promise<BroadcastRecord> {
    await BroadcastModel.create({
      _id: record.id,
      message: record.message,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      createdByUserId: record.createdByUserId,
    });
    return record;
  }

  async listActive(now: Date): Promise<BroadcastRecord[]> {
    const docs = await BroadcastModel.find({ expiresAt: { $gt: now } }).sort({ createdAt: -1 }).lean();
    return docs.map(toRecord);
  }

  async stop(id: string, now: Date): Promise<BroadcastRecord | null> {
    const doc = await BroadcastModel.findOneAndUpdate(
      { _id: id, expiresAt: { $gt: now } },
      { $set: { expiresAt: now } },
      { new: true },
    ).lean();
    return doc ? toRecord(doc) : null;
  }
}
