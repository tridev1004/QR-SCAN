import mongoose, { Model, Schema } from "mongoose";
import { NameStrikeBlock, NameStrikeBlockRepository } from "../../../domain/repositories/NameStrikeBlockRepository";

interface NameStrikeBlockDocument {
  _id: string;
  normalizedName: string;
  blockedUntil: Date;
  sourceEmployeeId: string;
  sourceEmployeeName: string;
  createdAt: Date;
}

const nameStrikeBlockSchema = new Schema<NameStrikeBlockDocument>(
  {
    _id: { type: String, required: true },
    normalizedName: { type: String, required: true, unique: true, index: true },
    blockedUntil: { type: Date, required: true, index: true },
    sourceEmployeeId: { type: String, required: true },
    sourceEmployeeName: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false },
);

const NameStrikeBlockModel: Model<NameStrikeBlockDocument> =
  mongoose.models.NameStrikeBlock ?? mongoose.model<NameStrikeBlockDocument>("NameStrikeBlock", nameStrikeBlockSchema);

function toRecord(doc: NameStrikeBlockDocument): NameStrikeBlock {
  return {
    normalizedName: doc.normalizedName,
    blockedUntil: doc.blockedUntil,
    sourceEmployeeId: doc.sourceEmployeeId,
    sourceEmployeeName: doc.sourceEmployeeName,
    createdAt: doc.createdAt,
  };
}

export class NameStrikeBlockRepositoryImpl implements NameStrikeBlockRepository {
  async upsert(block: NameStrikeBlock): Promise<NameStrikeBlock> {
    await NameStrikeBlockModel.findOneAndUpdate(
      { normalizedName: block.normalizedName },
      {
        $set: {
          _id: block.normalizedName,
          normalizedName: block.normalizedName,
          blockedUntil: block.blockedUntil,
          sourceEmployeeId: block.sourceEmployeeId,
          sourceEmployeeName: block.sourceEmployeeName,
          createdAt: block.createdAt,
        },
      },
      { upsert: true, new: true },
    );
    return block;
  }

  async findActive(normalizedName: string, now: Date): Promise<NameStrikeBlock | null> {
    const doc = await NameStrikeBlockModel.findOne({
      normalizedName,
      blockedUntil: { $gt: now },
    }).lean();
    return doc ? toRecord(doc) : null;
  }
}
