import mongoose, { Model, Schema } from "mongoose";
import { rewardInr, User } from "../../../domain/entities/User";
import { UserRole } from "../../../domain/enums/UserRole";
import { EmployeePayoutSource, UserPage, UserRepository } from "../../../domain/repositories/UserRepository";

interface UserDocument {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active?: boolean;
  emailVerified?: boolean;
  verificationTokenHash?: string | null;
  verificationExpiresAt?: Date | null;
  successRewardInr?: number;
  paidInr?: number;
  payouts?: { amountInr: number; paidAt: Date }[];
  hasPayoutQr?: boolean;
  upiId?: string | null;
  cooldownUntil?: Date | null;
  strikeResetAt?: Date | null;
}

const userSchema = new Schema<UserDocument>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true },
    active: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: true },
    verificationTokenHash: { type: String, default: null },
    verificationExpiresAt: { type: Date, default: null },
    successRewardInr: { type: Number, default: 0 },
    paidInr: { type: Number, default: 0 },
    payouts: { type: [{ amountInr: Number, paidAt: Date }], default: [] },
    hasPayoutQr: { type: Boolean, default: false },
    upiId: { type: String, default: "" },
    cooldownUntil: { type: Date, default: null },
    strikeResetAt: { type: Date, default: null },
  },
  { versionKey: false },
);

const payoutQrSchema = new Schema<{ _id: string; image: string }>(
  { _id: { type: String, required: true }, image: { type: String, required: true } },
  { versionKey: false },
);
const PayoutQrModel: Model<{ _id: string; image: string }> =
  (mongoose.models.EmployeePayoutQr as Model<{ _id: string; image: string }> | undefined) ??
  mongoose.model<{ _id: string; image: string }>("EmployeePayoutQr", payoutQrSchema);

const UserModel: Model<UserDocument> =
  (mongoose.models.User as Model<UserDocument> | undefined) ?? mongoose.model<UserDocument>("User", userSchema);

function toEntity(doc: UserDocument): User {
  return {
    id: doc._id,
    name: doc.name,
    email: doc.email,
    passwordHash: doc.passwordHash,
    role: doc.role,
    active: doc.active !== false,
    emailVerified: doc.emailVerified !== false,
    verificationTokenHash: doc.verificationTokenHash ?? undefined,
    verificationExpiresAt: doc.verificationExpiresAt ?? undefined,
    successRewardInr: rewardInr(doc.successRewardInr),
    paidInr: rewardInr(doc.paidInr),
    payouts: (doc.payouts ?? []).map((entry) => ({ amountInr: rewardInr(entry.amountInr), paidAt: entry.paidAt })),
    hasPayoutQr: doc.hasPayoutQr === true,
    upiId: doc.upiId || undefined,
    cooldownUntil: doc.cooldownUntil ?? undefined,
    strikeResetAt: doc.strikeResetAt ?? undefined,
  };
}

export class UserRepositoryImpl implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const doc = await UserModel.findById(id).lean();
    return doc ? toEntity(doc) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = await UserModel.findOne({ email: email.toLowerCase() }).lean();
    return doc ? toEntity(doc) : null;
  }

  async findByVerificationTokenHash(tokenHash: string): Promise<User | null> {
    const doc = await UserModel.findOne({ verificationTokenHash: tokenHash }).lean();
    return doc ? toEntity(doc) : null;
  }

  async listByRole(role: UserRole): Promise<User[]> {
    const docs = await UserModel.find({ role }).sort({ name: 1, _id: 1 }).lean();
    return docs.map(toEntity);
  }

  async listEmployeePayoutSources(): Promise<EmployeePayoutSource[]> {
    const docs = await UserModel.find({ role: UserRole.EMPLOYEE })
      .select({
        name: 1,
        email: 1,
        active: 1,
        successRewardInr: 1,
        paidInr: 1,
        hasPayoutQr: 1,
        upiId: 1,
        cooldownUntil: 1,
        payouts: { $slice: -1 },
      })
      .lean();
    return docs.map((doc) => ({
      id: doc._id,
      name: doc.name,
      email: doc.email,
      active: doc.active !== false,
      successRewardInr: rewardInr(doc.successRewardInr),
      paidInr: rewardInr(doc.paidInr),
      hasPayoutQr: doc.hasPayoutQr === true,
      upiId: doc.upiId || undefined,
      cooldownUntil: doc.cooldownUntil ?? undefined,
      lastPaidAt: doc.payouts?.at(-1)?.paidAt,
    }));
  }

  async listByRolePage(role: UserRole, offset: number, limit: number, q?: string): Promise<UserPage> {
    const filter: Record<string, unknown> = { role };
    const needle = q?.trim();
    if (needle) {
      const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: pattern }, { email: pattern }];
    }
    const [docs, total, activeCount] = await Promise.all([
      UserModel.find(filter).sort({ name: 1, _id: 1 }).skip(offset).limit(limit).lean(),
      UserModel.countDocuments(filter),
      UserModel.countDocuments({ ...filter, active: { $ne: false } }),
    ]);
    return { users: docs.map(toEntity), total, activeCount };
  }

  async create(user: User): Promise<User> {
    const created = await UserModel.create({
      _id: user.id,
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role,
      active: user.active,
      emailVerified: user.emailVerified !== false,
      verificationTokenHash: user.verificationTokenHash ?? null,
      verificationExpiresAt: user.verificationExpiresAt ?? null,
      successRewardInr: rewardInr(user.successRewardInr),
      paidInr: rewardInr(user.paidInr),
      payouts: user.payouts ?? [],
      hasPayoutQr: user.hasPayoutQr === true,
      upiId: user.upiId ?? "",
      cooldownUntil: user.cooldownUntil ?? null,
      strikeResetAt: user.strikeResetAt ?? null,
    });
    return toEntity(created.toObject());
  }

  async update(user: User): Promise<User> {
    const updated = await UserModel.findByIdAndUpdate(
      user.id,
      {
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role,
        active: user.active,
        emailVerified: user.emailVerified !== false,
        verificationTokenHash: user.verificationTokenHash ?? null,
        verificationExpiresAt: user.verificationExpiresAt ?? null,
        successRewardInr: rewardInr(user.successRewardInr),
        paidInr: rewardInr(user.paidInr),
        payouts: user.payouts ?? [],
        hasPayoutQr: user.hasPayoutQr === true,
        upiId: user.upiId ?? "",
        cooldownUntil: user.cooldownUntil ?? null,
        strikeResetAt: user.strikeResetAt ?? null,
      },
      { new: true },
    ).lean();
    if (!updated) {
      throw new Error("User disappeared during update");
    }
    return toEntity(updated);
  }

  async delete(id: string): Promise<void> {
    await UserModel.deleteOne({ _id: id });
  }

  async count(): Promise<number> {
    return UserModel.countDocuments();
  }

  async setPayoutQr(id: string, image: string | null): Promise<void> {
    if (!image) {
      await PayoutQrModel.deleteOne({ _id: id });
    } else {
      await PayoutQrModel.findByIdAndUpdate(id, { _id: id, image }, { upsert: true });
    }
    await UserModel.updateOne({ _id: id }, { $set: { hasPayoutQr: Boolean(image) } });
  }

  async getPayoutQr(id: string): Promise<string | null> {
    const doc = await PayoutQrModel.findById(id).lean();
    return doc?.image ?? null;
  }
}
