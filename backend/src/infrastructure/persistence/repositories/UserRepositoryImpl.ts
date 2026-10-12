import mongoose, { Model, Schema } from "mongoose";
import { rewardInr, User } from "../../../domain/entities/User";
import { UserRole } from "../../../domain/enums/UserRole";
import { UserPage, UserRepository } from "../../../domain/repositories/UserRepository";

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
  },
  { versionKey: false },
);

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

  async listByRolePage(role: UserRole, offset: number, limit: number): Promise<UserPage> {
    const filter = { role };
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
}
