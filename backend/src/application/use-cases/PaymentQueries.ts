import { isCoolingDown, PublicUser, rewardInr, User } from "../../domain/entities/User";
import { PaymentSession } from "../../domain/entities/PaymentSession";
import { PaymentStatus } from "../../domain/enums/PaymentStatus";
import { UserRole } from "../../domain/enums/UserRole";
import { ConflictError, ForbiddenError, NotFoundError } from "../../domain/errors/DomainError";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { isActive, isTerminal } from "../../domain/services/PaymentStateMachine";
import { toPaymentDto } from "../dto/payment.dto";
import { PaymentUseCaseDeps } from "./CreatePaymentSession";
import { startOfTodayIst } from "./EmployeeAccounts";
import { requireActiveEmployee } from "./ManageUsers";
import { updatePaymentStatus } from "./UpdatePaymentStatus";

export function assertCanViewPayment(user: PublicUser, session: PaymentSession): void {
  if (user.role === UserRole.ADMIN || user.role === UserRole.SESSION_VIEWER) {
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
  if (user.role === UserRole.SESSION_VIEWER) {
    throw new ForbiddenError();
  }
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

export async function getEmployeeDashboard(
  deps: PaymentUseCaseDeps,
  employee: User | null,
  page: { offset: number; limit: number; q?: string },
) {
  const employeeId = employee?.id ?? "";
  const cooling = isCoolingDown(employee, deps.now());
  const [assigned, open, history, counts, todayGroups] = await Promise.all([
    employee ? deps.payments.listPage({ employeeId, scope: "active" }, 0, 50) : Promise.resolve({ sessions: [], total: 0 }),
    cooling || !employee ? Promise.resolve([]) : deps.payments.listOpenBroadcasts(),
    employee
      ? deps.payments.listPage({ employeeId, scope: "finished", q: page.q }, page.offset, page.limit)
      : Promise.resolve({ sessions: [], total: 0 }),
    employee ? deps.payments.countOutcomes(employeeId) : Promise.resolve({ passed: 0, failed: 0 }),
    employee ? deps.payments.countSuccessGrouped(startOfTodayIst(deps.now())) : Promise.resolve([]),
  ]);
  const seen = new Set(assigned.sessions.map((session) => session.id));
  const live = [...open.filter((session) => !seen.has(session.id)), ...assigned.sessions].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  return {
    live: live.map(toPaymentDto),
    payments: history.sessions.map(toPaymentDto),
    total: history.total,
    hasMore: page.offset + history.sessions.length < history.total,
    earnings: employeeEarnings(employee, counts, todayGroups.find((row) => row.employeeId === employeeId)?.count ?? 0),
    cooldownUntil: cooling ? employee?.cooldownUntil?.toISOString() : undefined,
  };
}

function employeeEarnings(
  employee: User | null,
  counts: { passed: number; failed: number },
  todayPassed: number,
) {
  const rate = rewardInr(employee?.successRewardInr);
  const earnedInr = counts.passed * rate;
  const paidInr = rewardInr(employee?.paidInr);
  return {
    successRewardInr: rate,
    passedCount: counts.passed,
    failedCount: counts.failed,
    earnedInr,
    todayPassedCount: todayPassed,
    todayEarnedInr: todayPassed * rate,
    paidInr,
    unpaidInr: Math.max(0, earnedInr - paidInr),
    hasPayoutQr: employee?.hasPayoutQr === true,
  };
}

export async function getAdminPayments(
  deps: PaymentUseCaseDeps,
  filter: Parameters<PaymentUseCaseDeps["payments"]["listAll"]>[0],
  page?: { offset: number; limit: number },
) {
  if (!page) {
    const sessions = await deps.payments.listAll(filter);
    return { payments: sessions.map(toPaymentDto), total: sessions.length, hasMore: false };
  }
  const result = await deps.payments.listPage(filter, page.offset, page.limit);
  return {
    payments: result.sessions.map(toPaymentDto),
    total: result.total,
    hasMore: page.offset + result.sessions.length < result.total,
  };
}

export const MAX_ACTIVE_RESERVATIONS = 2;

export async function reservePaymentSession(
  deps: PaymentUseCaseDeps & { users: UserRepository },
  paymentSessionId: string,
  employeeId: string,
) {
  const employee = await requireActiveEmployee(deps.users, employeeId);
  const current = await deps.payments.findById(paymentSessionId);
  if (current?.assignedEmployeeId === employee.id && isActive(current.status)) {
    return current;
  }
  const held = await deps.payments.countActiveAssigned(employee.id);
  if (held >= MAX_ACTIVE_RESERVATIONS) {
    throw new ConflictError("Finish your two reserved QRs before reserving another");
  }
  const claimed = await deps.payments.claimIfOpen(paymentSessionId, employee.id, deps.now());
  if (!claimed) {
    const missing = await deps.payments.findById(paymentSessionId);
    if (!missing) {
      throw new NotFoundError();
    }
    throw new ConflictError("This QR was just reserved");
  }
  if ((await deps.payments.countActiveAssigned(employee.id)) > MAX_ACTIVE_RESERVATIONS) {
    await deps.payments.releaseClaim(claimed.id, employee.id, deps.now());
    throw new ConflictError("Finish your two reserved QRs before reserving another");
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
