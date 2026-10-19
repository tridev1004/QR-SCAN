import { UserRole } from "../enums/UserRole";

export interface PayoutRecord {
  amountInr: number;
  paidAt: Date;
  rangeFrom?: Date;
  rangeTo?: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  emailVerified?: boolean;
  verificationTokenHash?: string;
  verificationExpiresAt?: Date;
  successRewardInr?: number;
  paidInr?: number;
  payouts?: PayoutRecord[];
  hasPayoutQr?: boolean;
  upiId?: string;
  cooldownUntil?: Date;
  strikeResetAt?: Date;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  successRewardInr: number;
  cooldownUntil?: string;
  hasPayoutQr?: boolean;
}

export function isCoolingDown(user: { cooldownUntil?: Date } | null | undefined, now: Date): boolean {
  return Boolean(user?.cooldownUntil && user.cooldownUntil.getTime() > now.getTime());
}

export function rewardInr(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.trunc(value);
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    successRewardInr: rewardInr(user.successRewardInr),
    cooldownUntil: user.cooldownUntil?.toISOString(),
    hasPayoutQr: user.hasPayoutQr === true,
  };
}
