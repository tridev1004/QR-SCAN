import { UserRole } from "../enums/UserRole";

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
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  successRewardInr: number;
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
  };
}
