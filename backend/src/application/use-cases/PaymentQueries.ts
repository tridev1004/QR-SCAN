import { PublicUser, rewardInr } from "../../domain/entities/User";
import { PaymentSession } from "../../domain/entities/PaymentSession";
import { PaymentStatus } from "../../domain/enums/PaymentStatus";
import { UserRole } from "../../domain/enums/UserRole";
import { ConflictError, ForbiddenError, NotFoundError } from "../../domain/errors/DomainError";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { isTerminal } from "../../domain/services/PaymentStateMachine";
import { toPaymentDto } from "../dto/payment.dto";
import { PaymentUseCaseDeps } from "./CreatePaymentSession";
import { requireActiveEmployee } from "./ManageUsers";
import { updatePaymentStatus } from "./UpdatePaymentStatus";

export function assertCanViewPayment(user: PublicUser, session: PaymentSession): void {
  if (user.role === UserRole.ADMIN) {
    return;
  }
  if (user.role === UserRole.EMPLOYEE && session.assignedEmployeeId === user.id) {
    return;
  }
  if (user.role === UserRole.EMPLOYEE && session.broadcast && !session.assignedEmployeeId) {
    return;
  }
  throw new ForbiddenError();
}

export async function getPaymentSession(deps: PaymentUseCaseDeps, user: PublicUser, paymentSessionId: string) {
  const session = await deps.payments.findById(paymentSessionId);
  if (!session) {
    throw new NotFoundError();
  }
  assertCanViewPayment(user, session);
  return session;
}

export async function getPaymentQr(deps: PaymentUseCaseDeps, user: PublicUser, paymentSessionId: string) {
  const session = await getPaymentSession(deps, user, paymentSessionId);
  if (user.role !== UserRole.ADMIN && session.assignedEmployeeId !== user.id) {
    throw new ForbiddenError("Reserve this QR before opening it");
  }
  if (isTerminal(session.status)) {
    return null;
  }
  return deps.qrCache.get(session.id);
}

export interface EmployeeEarnings {
  successRewardInr: number;
  passedCount: number;
  failedCount: number;
  earnedInr: number;
}

export function summarizeEmployeeEarnings(
  sessions: Array<{ status: PaymentStatus }>,
  successRewardInr: number,
): EmployeeEarnings {
  const rate = rewardInr(successRewardInr);
  const passedCount = sessions.filter((session) => session.status === PaymentStatus.SUCCESS).length;
  const failedCount = sessions.filter((session) => session.status === PaymentStatus.FAILED).length;
  return {
    successRewardInr: rate,
    passedCount,
    failedCount,
    earnedInr: passedCount * rate,
  };
}

export async function getEmployeePayments(deps: PaymentUseCaseDeps, employeeId: string) {
  const mine = await deps.payments.listAll({ employeeId });
  const open = await deps.payments.listOpenBroadcasts();
  const seen = new Set(mine.map((session) => session.id));
  const visible = [...open.filter((session) => !seen.has(session.id)), ...mine].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  return visible.map(toPaymentDto);
}

export async function getAdminPayments(
  deps: PaymentUseCaseDeps,
  filter: Parameters<PaymentUseCaseDeps["payments"]["listAll"]>[0],
) {
  const sessions = await deps.payments.listAll(filter);
  return sessions.map(toPaymentDto);
}

export async function reservePaymentSession(
  deps: PaymentUseCaseDeps & { users: UserRepository },
  paymentSessionId: string,
  employeeId: string,
) {
  const employee = await requireActiveEmployee(deps.users, employeeId);
  const claimed = await deps.payments.claimIfOpen(paymentSessionId, employee.id, deps.now());
  if (!claimed) {
    const current = await deps.payments.findById(paymentSessionId);
    if (!current) {
      throw new NotFoundError();
    }
    throw new ConflictError("This QR was just reserved");
  }
  deps.events.publish({ type: "payment-assigned", data: toPaymentDto(claimed) });
  return claimed;
}

export async function assignPaymentSession(
  deps: PaymentUseCaseDeps & { users: UserRepository },
  paymentSessionId: string,
  employeeId: string,
) {
  const session = await deps.payments.findById(paymentSessionId);
  if (!session) {
    throw new NotFoundError();
  }
  if (isTerminal(session.status)) {
    throw new ForbiddenError("Finished sessions cannot be reassigned");
  }

  const employee = await requireActiveEmployee(deps.users, employeeId);

  const saved = await deps.payments.update({
    ...session,
    assignedEmployeeId: employee.id,
    updatedAt: deps.now(),
  });

  deps.events.publish({ type: "payment-assigned", data: toPaymentDto(saved) });
  return saved;
}

export async function cancelPaymentSession(deps: PaymentUseCaseDeps, paymentSessionId: string) {
  return updatePaymentStatus(deps, paymentSessionId, PaymentStatus.FAILED, "Cancelled by admin");
}

export async function recordHeartbeat(deps: PaymentUseCaseDeps, paymentSessionIds: string[]) {
  const now = deps.now();
  for (const id of paymentSessionIds) {
    const session = await deps.payments.findById(id);
    if (!session || isTerminal(session.status)) {
      continue;
    }
    await deps.payments.update({ ...session, lastSeenAt: now, updatedAt: session.updatedAt });
  }
}
