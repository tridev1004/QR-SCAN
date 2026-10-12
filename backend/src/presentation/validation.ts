import { z } from "zod";
import { PaymentStatus } from "../domain/enums/PaymentStatus";

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(200),
});

export const signupEmailSchema = z.object({
  email: z.string().email(),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20).max(200),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
  portal: z.enum(["employee", "admin"]),
});

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(200),
});

export const employeeActiveSchema = z.object({
  active: z.boolean(),
});

export const employeePasswordSchema = z.object({
  password: z.string().min(6).max(200),
});

export const employeeRewardSchema = z.object({
  successRewardInr: z.number().int().min(0).max(100_000),
});

export const employeeListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).max(100_000).optional(),
});

export const createPaymentSchema = z.object({
  localSessionId: z.string().uuid(),
  assignedEmployeeId: z.string().min(1).max(80),
  qrFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  qrImage: z
    .string()
    .max(1_500_000)
    .refine((value) => value.startsWith("data:image/png;base64,"), "QR image must be a PNG data URL"),
  expiresAt: z.string().datetime(),
});

export const statusSchema = z.object({
  status: z.nativeEnum(PaymentStatus),
  errorMessage: z.string().max(300).optional(),
});

export const assignSchema = z.object({
  employeeId: z.string().min(1).max(80),
});

export const heartbeatSchema = z.object({
  paymentSessionIds: z.array(z.string().uuid()).max(50),
});

export const adminQuerySchema = z.object({
  status: z.nativeEnum(PaymentStatus).optional(),
  employeeId: z.string().min(1).max(80).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  scope: z.enum(["active", "expired", "all"]).optional(),
});
