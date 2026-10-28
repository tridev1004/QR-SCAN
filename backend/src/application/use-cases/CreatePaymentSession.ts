import { randomUUID } from "crypto";
import { PaymentSession } from "../../domain/entities/PaymentSession";
import { PaymentStatus } from "../../domain/enums/PaymentStatus";
import { ConflictError } from "../../domain/errors/DomainError";
import { PaymentSessionRepository } from "../../domain/repositories/PaymentSessionRepository";
import { transitionSession } from "../../domain/services/PaymentStateMachine";
import { PaymentQrCache } from "../../infrastructure/cache/PaymentQrCache";
import { PaymentEventBus } from "../../infrastructure/realtime/PaymentEventBus";
import { MailVerifyClient } from "../../infrastructure/email/BiskiMailClient";
import { toPaymentDto } from "../dto/payment.dto";

export interface CreatePaymentSessionInput {
  localSessionId: string;
  assignedEmployeeId?: string;
  broadcast?: boolean;
  qrFingerprint: string;
  qrImage: string;
  accountEmail?: string;
  expiresAt?: Date;
  createdByUserId: string;
}

export interface PaymentUseCaseDeps {
  payments: PaymentSessionRepository;
  qrCache: PaymentQrCache;
  events: PaymentEventBus;
  now: () => Date;
  mailVerify?: MailVerifyClient;
}

export async function createPaymentSession(deps: PaymentUseCaseDeps, input: CreatePaymentSessionInput) {
  const existingByLocal = await deps.payments.findByExternalSessionId(input.localSessionId);
  if (existingByLocal) {
    return { session: existingByLocal, created: false };
  }

  const existingByQr = await deps.payments.findActiveByFingerprint(input.qrFingerprint);
  if (existingByQr) {
    return { session: existingByQr, created: false };
  }

  const now = deps.now();
  const detected: PaymentSession = {
    id: randomUUID(),
    code: await deps.payments.nextCode(),
    externalSessionId: input.localSessionId,
    qrFingerprint: input.qrFingerprint,
    accountEmail: input.accountEmail ? input.accountEmail.trim().toLowerCase() : undefined,
    assignedEmployeeId: input.broadcast ? undefined : input.assignedEmployeeId,
    broadcast: input.broadcast === true,
    createdByUserId: input.createdByUserId,
    status: PaymentStatus.DETECTED,
    expiresAt: input.expiresAt,
    createdAt: now,
    updatedAt: now,
    history: [{ status: PaymentStatus.DETECTED, at: now, message: "QR detected" }],
  };

  const ready = transitionSession(detected, PaymentStatus.QR_READY, now, "QR ready");

  try {
    const saved = await deps.payments.create(ready);
    await deps.qrCache.set(saved.id, input.qrImage, input.expiresAt);
    deps.events.publish({ type: "payment-created", data: toPaymentDto(saved) });
    return { session: saved, created: true };
  } catch (error) {
    if (isDuplicate(error)) {
      const winner =
        (await deps.payments.findByExternalSessionId(input.localSessionId)) ??
        (await deps.payments.findActiveByFingerprint(input.qrFingerprint));
      if (winner) {
        return { session: winner, created: false };
      }
    }
    throw error;
  }
}

function isDuplicate(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number | string }).code === 11000
  ) || error instanceof ConflictError;
}
