import { PaymentSession } from "../entities/PaymentSession";
import { ACTIVE_STATUSES, PaymentStatus, TERMINAL_STATUSES } from "../enums/PaymentStatus";
import { InvalidTransitionError } from "../errors/DomainError";

const TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  [PaymentStatus.DETECTED]: [PaymentStatus.QR_READY, PaymentStatus.FAILED, PaymentStatus.EXPIRED],
  [PaymentStatus.QR_READY]: [
    PaymentStatus.WAITING_FOR_PAYMENT,
    PaymentStatus.FAILED,
    PaymentStatus.EXPIRED,
  ],
  [PaymentStatus.WAITING_FOR_PAYMENT]: [
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.EXPIRED,
  ],
  [PaymentStatus.SUCCESS]: [],
  [PaymentStatus.FAILED]: [],
  [PaymentStatus.EXPIRED]: [],
};

export function isTerminal(status: PaymentStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isActive(status: PaymentStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function assertCanTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (from === to) {
    return;
  }
  if (!TRANSITIONS[from].includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export function transitionSession(
  session: PaymentSession,
  to: PaymentStatus,
  now: Date,
  message?: string,
): PaymentSession {
  assertCanTransition(session.status, to);
  if (session.status === to) {
    return session;
  }

  const terminal = isTerminal(to);
  return {
    ...session,
    status: to,
    updatedAt: now,
    completedAt: terminal ? now : session.completedAt,
    errorMessage: to === PaymentStatus.FAILED ? message ?? session.errorMessage : session.errorMessage,
    history: [...session.history, { status: to, at: now, message }],
  };
}
