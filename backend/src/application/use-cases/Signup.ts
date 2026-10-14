import { createHash, randomBytes, randomUUID } from "crypto";
import { UserRole } from "../../domain/enums/UserRole";
import { ConflictError, DomainError } from "../../domain/errors/DomainError";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { Mailer } from "../../infrastructure/email/Mailer";
import { hashPassword } from "../../infrastructure/auth/password";
import { DEFAULT_SUCCESS_REWARD_INR } from "./ManageUsers";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export function hashVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function assertSignupEmailAvailable(users: UserRepository, email: string): Promise<void> {
  const existing = await users.findByEmail(email.toLowerCase());
  if (existing) {
    throw new ConflictError("An account with this email already exists");
  }
}

export async function signupEmployee(
  users: UserRepository,
  mailer: Mailer,
  input: { name: string; email: string; password: string },
  appPublicUrl: string,
  now: Date,
) {
  const email = input.email.toLowerCase();
  const name = input.name.trim();
  await assertSignupEmailAvailable(users, email);

  const token = randomBytes(32).toString("base64url");
  const verificationTokenHash = hashVerificationToken(token);
  const verificationExpiresAt = new Date(now.getTime() + VERIFICATION_TTL_MS);
  const passwordHash = await hashPassword(input.password);
  let user;
  try {
    user = await users.create({
      id: randomUUID(),
      name,
      email,
      passwordHash,
      role: UserRole.EMPLOYEE,
      active: false,
      emailVerified: false,
      successRewardInr: DEFAULT_SUCCESS_REWARD_INR,
      verificationTokenHash,
      verificationExpiresAt,
    });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: number }).code : undefined;
    if (code === 11000) {
      throw new ConflictError("An account with this email already exists");
    }
    throw error;
  }

  const verifyUrl = `${appPublicUrl.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
  try {
    await mailer.sendVerification({ to: user.email, name: user.name, verifyUrl });
  } catch (error) {
    await users.delete(user.id);
    throw new DomainError(
      error instanceof Error && error.message === "Email verification is not configured"
        ? error.message
        : "Could not send the verification email. Try again in a moment.",
      "VALIDATION",
      error instanceof Error && error.message === "Email verification is not configured" ? 503 : 502,
    );
  }
}

export async function verifySignupEmail(users: UserRepository, token: string, now: Date) {
  const user = await users.findByVerificationTokenHash(hashVerificationToken(token));
  if (!user || !user.verificationExpiresAt || user.verificationExpiresAt.getTime() <= now.getTime()) {
    throw new DomainError("This verification link is invalid or has expired", "VALIDATION", 400);
  }
  if (user.emailVerified === true && user.active) {
    return;
  }
  await users.update({
    ...user,
    active: true,
    emailVerified: true,
  });
}
