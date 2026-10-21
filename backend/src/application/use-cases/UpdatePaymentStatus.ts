import { PaymentStatus } from "../../domain/enums/PaymentStatus";
import { NotFoundError } from "../../domain/errors/DomainError";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { isTerminal, transitionSession } from "../../domain/services/PaymentStateMachine";
import { toPaymentDto } from "../dto/payment.dto";
import { PaymentUseCaseDeps } from "./CreatePaymentSession";
import { noteEmployeeStrike } from "./EmployeeAccounts";

const STATUS_MESSAGE: Partial<Record<PaymentStatus, string>> = {
  [PaymentStatus.QR_READY]: "QR ready",
  [PaymentStatus.WAITING_FOR_PAYMENT]: "Waiting for verification",
  [PaymentStatus.SUCCESS]: "Payment successful",
  [PaymentStatus.FAILED]: "Payment failed",
  [PaymentStatus.EXPIRED]: "QR expired",
};

export async function updatePaymentStatus(
  deps: PaymentUseCaseDeps & { users?: UserRepository },
  paymentSessionId: string,
  status: PaymentStatus,
  errorMessage?: string,
) {
  const current = await deps.payments.findById(paymentSessionId);
  if (!current) {
    throw new NotFoundError();
  }

  if (current.status === status) {
    return current;
  }
  if (
    isTerminal(current.status) &&
    (status === PaymentStatus.FAILED || status === PaymentStatus.EXPIRED) &&
    (current.status === PaymentStatus.FAILED || current.status === PaymentStatus.EXPIRED)
  ) {
    return current;
  }

  const now = deps.now();
  const message = status === PaymentStatus.FAILED ? errorMessage ?? STATUS_MESSAGE[status] : STATUS_MESSAGE[status];
  const next = transitionSession(current, status, now, message);
  const saved = await deps.payments.update(next);

  if (isTerminal(saved.status)) {
    await deps.qrCache.delete(saved.id);
  }

  deps.events.publish({
    type: "payment-status",
    data: {
      paymentSessionId: saved.id,
      status: saved.status,
      errorMessage: saved.errorMessage,
      completedAt: saved.completedAt?.toISOString(),
      assignedEmployeeId: saved.assignedEmployeeId,
    },
  });

  if (deps.users) {
    await noteEmployeeStrike(deps.users, deps.payments, saved.assignedEmployeeId, saved.status, now);
  }

  return saved;
}

export async function expireDuePayments(deps: PaymentUseCaseDeps): Promise<number> {
  const due = await deps.payments.findDueForExpiry(deps.now());
  let count = 0;
  for (const session of due) {
    await updatePaymentStatus(deps, session.id, PaymentStatus.EXPIRED);
    count += 1;
  }
  return count;
}

export { toPaymentDto };
