import { describe, expect, it } from "vitest";
import { PaymentStatus } from "../enums/PaymentStatus";
import { InvalidTransitionError } from "../errors/DomainError";
import { assertCanTransition, isTerminal, transitionSession } from "./PaymentStateMachine";
import { PaymentSession } from "../entities/PaymentSession";

function session(status: PaymentStatus): PaymentSession {
  const now = new Date("2026-10-01T10:00:00.000Z");
  return {
    id: "pay-1",
    code: "PAY-001",
    qrFingerprint: "a".repeat(64),
    status,
    createdAt: now,
    updatedAt: now,
    history: [{ status, at: now }],
  };
}

describe("PaymentStateMachine", () => {
  it("allows the happy path through waiting to success", () => {
    expect(() => assertCanTransition(PaymentStatus.DETECTED, PaymentStatus.QR_READY)).not.toThrow();
    expect(() =>
      assertCanTransition(PaymentStatus.QR_READY, PaymentStatus.WAITING_FOR_PAYMENT),
    ).not.toThrow();
    expect(() =>
      assertCanTransition(PaymentStatus.WAITING_FOR_PAYMENT, PaymentStatus.SUCCESS),
    ).not.toThrow();
  });

  it("rejects transitions out of terminal states", () => {
    expect(() => assertCanTransition(PaymentStatus.SUCCESS, PaymentStatus.WAITING_FOR_PAYMENT)).toThrow(
      InvalidTransitionError,
    );
    expect(() => assertCanTransition(PaymentStatus.FAILED, PaymentStatus.QR_READY)).toThrow(
      InvalidTransitionError,
    );
    expect(() => assertCanTransition(PaymentStatus.EXPIRED, PaymentStatus.SUCCESS)).toThrow(
      InvalidTransitionError,
    );
  });

  it("treats the same status as an idempotent no-op", () => {
    const now = new Date("2026-10-01T10:05:00.000Z");
    const current = session(PaymentStatus.SUCCESS);
    const next = transitionSession(current, PaymentStatus.SUCCESS, now, "again");
    expect(next).toBe(current);
    expect(next.history).toHaveLength(1);
  });

  it("records history and completedAt when a session expires", () => {
    const now = new Date("2026-10-01T10:05:00.000Z");
    const next = transitionSession(session(PaymentStatus.WAITING_FOR_PAYMENT), PaymentStatus.EXPIRED, now, "QR expired");
    expect(next.status).toBe(PaymentStatus.EXPIRED);
    expect(next.completedAt).toEqual(now);
    expect(next.history.at(-1)?.message).toBe("QR expired");
    expect(isTerminal(next.status)).toBe(true);
  });
});
