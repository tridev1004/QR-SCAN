import mongoose, { Model, Schema } from "mongoose";
import { PaymentHistoryEntry, PaymentListFilter, PaymentSession } from "../../../domain/entities/PaymentSession";
import { ACTIVE_STATUSES, PaymentStatus } from "../../../domain/enums/PaymentStatus";
import { PaymentSessionRepository } from "../../../domain/repositories/PaymentSessionRepository";

interface PaymentDocument {
  _id: string;
  code: string;
  externalSessionId?: string;
  qrFingerprint: string;
  assignedEmployeeId?: string;
  broadcast?: boolean;
  createdByUserId?: string;
  status: PaymentStatus;
  amount?: number;
  currency?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  lastSeenAt?: Date;
  history: PaymentHistoryEntry[];
}

const historySchema = new Schema<PaymentHistoryEntry>(
  {
    status: { type: String, required: true },
    at: { type: Date, required: true },
    message: { type: String },
  },
  { _id: false },
);

const paymentSchema = new Schema<PaymentDocument>(
  {
    _id: { type: String, required: true },
    code: { type: String, required: true },
    externalSessionId: { type: String },
    qrFingerprint: { type: String, required: true },
    assignedEmployeeId: { type: String },
    broadcast: { type: Boolean, default: false },
    createdByUserId: { type: String },
    status: { type: String, required: true },
    amount: { type: Number },
    currency: { type: String },
    expiresAt: { type: Date },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    completedAt: { type: Date },
    errorMessage: { type: String },
    lastSeenAt: { type: Date },
    history: { type: [historySchema], default: [] },
  },
  { versionKey: false },
);

paymentSchema.index(
  { qrFingerprint: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: [...ACTIVE_STATUSES] } },
  },
);
paymentSchema.index({ externalSessionId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ assignedEmployeeId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, expiresAt: 1 });
paymentSchema.index({ code: 1 });

const PaymentModel: Model<PaymentDocument> =
  (mongoose.models.PaymentSession as Model<PaymentDocument> | undefined) ??
  mongoose.model<PaymentDocument>("PaymentSession", paymentSchema);

interface CounterDocument {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDocument>(
  { _id: { type: String, required: true }, seq: { type: Number, required: true } },
  { versionKey: false },
);
const CounterModel: Model<CounterDocument> =
  (mongoose.models.Counter as Model<CounterDocument> | undefined) ??
  mongoose.model<CounterDocument>("Counter", counterSchema);

function toEntity(doc: PaymentDocument): PaymentSession {
  return {
    id: doc._id,
    code: doc.code,
    externalSessionId: doc.externalSessionId,
    qrFingerprint: doc.qrFingerprint,
    assignedEmployeeId: doc.assignedEmployeeId,
    broadcast: doc.broadcast === true,
    createdByUserId: doc.createdByUserId,
    status: doc.status,
    amount: doc.amount,
    currency: doc.currency,
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    completedAt: doc.completedAt,
    errorMessage: doc.errorMessage,
    lastSeenAt: doc.lastSeenAt,
    history: doc.history ?? [],
  };
}

function toDocument(session: PaymentSession): PaymentDocument {
  return {
    _id: session.id,
    code: session.code,
    externalSessionId: session.externalSessionId,
    qrFingerprint: session.qrFingerprint,
    assignedEmployeeId: session.assignedEmployeeId,
    broadcast: session.broadcast === true,
    createdByUserId: session.createdByUserId,
    status: session.status,
    amount: session.amount,
    currency: session.currency,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    completedAt: session.completedAt,
    errorMessage: session.errorMessage,
    lastSeenAt: session.lastSeenAt,
    history: session.history,
  };
}

export class PaymentSessionRepositoryImpl implements PaymentSessionRepository {
  async create(session: PaymentSession): Promise<PaymentSession> {
    const created = await PaymentModel.create(toDocument(session));
    return toEntity(created.toObject());
  }

  async findById(id: string): Promise<PaymentSession | null> {
    const doc = await PaymentModel.findById(id).lean();
    return doc ? toEntity(doc) : null;
  }

  async findActiveByFingerprint(fingerprint: string): Promise<PaymentSession | null> {
    const doc = await PaymentModel.findOne({
      qrFingerprint: fingerprint,
      status: { $in: [...ACTIVE_STATUSES] },
    }).lean();
    return doc ? toEntity(doc) : null;
  }

  async findByExternalSessionId(externalSessionId: string): Promise<PaymentSession | null> {
    const doc = await PaymentModel.findOne({ externalSessionId }).lean();
    return doc ? toEntity(doc) : null;
  }

  async update(session: PaymentSession): Promise<PaymentSession> {
    const doc = await PaymentModel.findByIdAndUpdate(session.id, toDocument(session), { new: true }).lean();
    if (!doc) {
      throw new Error("Payment session disappeared during update");
    }
    return toEntity(doc);
  }

  async claimIfOpen(id: string, employeeId: string, now: Date): Promise<PaymentSession | null> {
    const doc = await PaymentModel.findOneAndUpdate(
      {
        _id: id,
        broadcast: true,
        assignedEmployeeId: null,
        status: { $in: [...ACTIVE_STATUSES] },
      },
      { $set: { assignedEmployeeId: employeeId, broadcast: false, updatedAt: now } },
      { new: true },
    ).lean();
    if (doc) {
      return toEntity(doc);
    }
    const current = await PaymentModel.findById(id).lean();
    if (current?.assignedEmployeeId === employeeId) {
      return toEntity(current);
    }
    return null;
  }

  async countActiveAssigned(employeeId: string): Promise<number> {
    return PaymentModel.countDocuments({
      assignedEmployeeId: employeeId,
      status: { $in: [...ACTIVE_STATUSES] },
    });
  }

  async releaseClaim(id: string, employeeId: string, now: Date): Promise<PaymentSession | null> {
    const doc = await PaymentModel.findOneAndUpdate(
      { _id: id, assignedEmployeeId: employeeId, status: { $in: [...ACTIVE_STATUSES] } },
      { $set: { assignedEmployeeId: null, broadcast: true, updatedAt: now } },
      { new: true },
    ).lean();
    return doc ? toEntity(doc) : null;
  }

  async listOpenBroadcasts(): Promise<PaymentSession[]> {
    const docs = await PaymentModel.find({
      broadcast: true,
      assignedEmployeeId: null,
      status: { $in: [...ACTIVE_STATUSES] },
    })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map(toEntity);
  }

  async listForEmployee(employeeId: string): Promise<PaymentSession[]> {
    const docs = await PaymentModel.find({ assignedEmployeeId: employeeId }).sort({ createdAt: -1 }).lean();
    return docs.map(toEntity);
  }

  async listAll(filter: PaymentListFilter): Promise<PaymentSession[]> {
    const docs = await PaymentModel.find(paymentQuery(filter)).sort({ createdAt: -1 }).limit(200).lean();
    return docs.map(toEntity);
  }

  async listPage(
    filter: PaymentListFilter,
    offset: number,
    limit: number,
  ): Promise<{ sessions: PaymentSession[]; total: number }> {
    const query = paymentQuery(filter);
    const [docs, total] = await Promise.all([
      PaymentModel.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      PaymentModel.countDocuments(query),
    ]);
    return { sessions: docs.map(toEntity), total };
  }

  async countOutcomes(employeeId: string): Promise<{ passed: number; failed: number }> {
    const [passed, failed] = await Promise.all([
      PaymentModel.countDocuments({ assignedEmployeeId: employeeId, status: PaymentStatus.SUCCESS }),
      PaymentModel.countDocuments({ assignedEmployeeId: employeeId, status: PaymentStatus.FAILED }),
    ]);
    return { passed, failed };
  }

  async countStrikes(employeeId: string, since: Date): Promise<number> {
    return PaymentModel.countDocuments({
      assignedEmployeeId: employeeId,
      status: { $in: [PaymentStatus.FAILED, PaymentStatus.EXPIRED] },
      completedAt: { $gt: since },
    });
  }

  async countSuccessGrouped(from?: Date): Promise<Array<{ employeeId: string; count: number }>> {
    const match: Record<string, unknown> = {
      status: PaymentStatus.SUCCESS,
      assignedEmployeeId: { $type: "string" },
    };
    if (from) match.completedAt = { $gte: from };
    const rows = await PaymentModel.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: "$assignedEmployeeId", count: { $sum: 1 } } },
    ]);
    return rows.map((row) => ({ employeeId: row._id, count: row.count }));
  }

  async findDueForExpiry(now: Date): Promise<PaymentSession[]> {
    const docs = await PaymentModel.find({
      status: { $in: [...ACTIVE_STATUSES] },
      expiresAt: { $lte: now },
    }).lean();
    return docs.map(toEntity);
  }

  async nextCode(): Promise<string> {
    const counter = await CounterModel.findByIdAndUpdate(
      "payment",
      { $inc: { seq: 1 } },
      { upsert: true, new: true },
    ).lean();
    return `PAY-${String(counter?.seq ?? 1).padStart(3, "0")}`;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function paymentQuery(filter: PaymentListFilter): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filter.employeeId) query.assignedEmployeeId = filter.employeeId;
  if (filter.from || filter.to) {
    query.createdAt = {
      ...(filter.from ? { $gte: filter.from } : {}),
      ...(filter.to ? { $lte: filter.to } : {}),
    };
  }
  if (filter.status) query.status = filter.status;
  if (filter.scope === "active") query.status = { $in: [...ACTIVE_STATUSES] };
  if (filter.scope === "expired") query.status = PaymentStatus.EXPIRED;
  if (filter.scope === "finished") {
    query.status = { $in: [PaymentStatus.SUCCESS, PaymentStatus.FAILED, PaymentStatus.EXPIRED] };
  }
  if (filter.q) query.code = new RegExp(escapeRegex(filter.q), "i");
  return query;
}
