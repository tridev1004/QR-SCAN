import { isCoolingDown, rewardInr, User } from "../../domain/entities/User";
import { PaymentStatus } from "../../domain/enums/PaymentStatus";
import { UserRole } from "../../domain/enums/UserRole";
import { ConflictError, NotFoundError } from "../../domain/errors/DomainError";
import { PaymentSessionRepository } from "../../domain/repositories/PaymentSessionRepository";
import { UserRepository } from "../../domain/repositories/UserRepository";

export async function getExtensionUserStats(users: UserRepository, payments: PaymentSessionRepository) {
  const [senders, outcomes] = await Promise.all([
    users.listByRole(UserRole.EXTENSION_USER),
    payments.countCreatorOutcomes(),
  ]);
  const byId = new Map(outcomes.map((row) => [row.userId, row]));
  const rows = senders
    .map((sender) => {
      const counts = byId.get(sender.id) ?? { passed: 0, failed: 0 };
      const rate = rewardInr(sender.successRewardInr);
      return {
        id: sender.id,
        name: sender.name,
        email: sender.email,
        active: sender.active,
        successRewardInr: rate,
        passedCount: counts.passed,
        failedCount: counts.failed,
        earnedInr: counts.passed * rate,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  return {
    passedCount: rows.reduce((sum, row) => sum + row.passedCount, 0),
    failedCount: rows.reduce((sum, row) => sum + row.failedCount, 0),
    earnedInr: rows.reduce((sum, row) => sum + row.earnedInr, 0),
    users: rows,
  };
}

const IST_DAY_MS = 24 * 60 * 60 * 1000;

export function formatIstDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function parseIstDate(value: string): Date {
  return new Date(`${value}T00:00:00+05:30`);
}

export function defaultStatisticsRange(now: Date): { from: Date; to: Date } {
  const endExclusive = new Date(startOfTodayIst(now).getTime() + IST_DAY_MS);
  return { from: new Date(endExclusive.getTime() - 30 * IST_DAY_MS), to: endExclusive };
}

export async function getAdminStatistics(
  users: UserRepository,
  payments: PaymentSessionRepository,
  from: Date,
  to: Date,
) {
  const [terminal, employees, paidInr] = await Promise.all([
    payments.countTerminalInRange(from, to),
    users.listEmployeePayoutSources(),
    users.sumPayoutsBetween(from, to),
  ]);
  const rates = new Map(employees.map((employee) => [employee.id, rewardInr(employee.successRewardInr)]));
  const earnedInr = terminal.passedByEmployee.reduce(
    (sum, row) => sum + row.count * (rates.get(row.employeeId) ?? 0),
    0,
  );
  return {
    from: formatIstDate(from),
    to: formatIstDate(new Date(to.getTime() - IST_DAY_MS)),
    passed: terminal.passed,
    failed: terminal.failed,
    expired: terminal.expired,
    paidInr,
    unpaidInr: Math.max(0, earnedInr - paidInr),
  };
}

export const COOLDOWN_MS = 3 * 60 * 60 * 1000;
export const STRIKE_LIMIT = 2;

export function startOfTodayIst(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return new Date(`${year}-${month}-${day}T00:00:00+05:30`);
}

export async function noteEmployeeStrike(
  users: UserRepository,
  payments: PaymentSessionRepository,
  employeeId: string | undefined,
  status: PaymentStatus,
  now: Date,
): Promise<void> {
  if (!employeeId || (status !== PaymentStatus.FAILED && status !== PaymentStatus.EXPIRED)) {
    return;
  }
  const employee = await users.findById(employeeId);
  if (!employee || employee.role !== UserRole.EMPLOYEE || isCoolingDown(employee, now)) {
    return;
  }
  const strikes = await payments.consecutiveStrikes(employeeId, employee.strikeResetAt ?? new Date(0));
  if (strikes < STRIKE_LIMIT) {
    return;
  }
  const cooldownUntil = new Date(now.getTime() + COOLDOWN_MS);
  await users.update({ ...employee, cooldownUntil, strikeResetAt: cooldownUntil });
}

export async function clearEmployeePause(users: UserRepository, employeeId: string, now: Date): Promise<User> {
  const employee = await users.findById(employeeId);
  if (!employee || employee.role !== UserRole.EMPLOYEE) {
    throw new NotFoundError("Employee not found");
  }
  return users.update({ ...employee, cooldownUntil: undefined, strikeResetAt: now });
}

export async function saveEmployeeUpiId(users: UserRepository, employeeId: string, upiId: string): Promise<void> {
  const employee = await users.findById(employeeId);
  if (!employee || employee.role !== UserRole.EMPLOYEE) {
    throw new NotFoundError("Employee not found");
  }
  await users.update({ ...employee, upiId: upiId || undefined });
}

export async function saveEmployeePayoutQr(users: UserRepository, employeeId: string, image: string): Promise<void> {
  const employee = await users.findById(employeeId);
  if (!employee || employee.role !== UserRole.EMPLOYEE) {
    throw new NotFoundError("Employee not found");
  }
  await users.setPayoutQr(employee.id, image);
}

export async function markEmployeePaid(
  users: UserRepository,
  payments: PaymentSessionRepository,
  employeeId: string,
  now: Date,
): Promise<User> {
  const employee = await users.findById(employeeId);
  if (!employee || employee.role !== UserRole.EMPLOYEE) {
    throw new NotFoundError("Employee not found");
  }
  const counts = await payments.countOutcomes(employee.id);
  const earnedInr = counts.passed * rewardInr(employee.successRewardInr);
  const alreadyPaid = rewardInr(employee.paidInr);
  const unpaidInr = Math.max(0, earnedInr - alreadyPaid);
  if (unpaidInr <= 0) {
    throw new ConflictError("Nothing is waiting to be paid");
  }
  return users.update({
    ...employee,
    paidInr: earnedInr,
    payouts: [...(employee.payouts ?? []), { amountInr: unpaidInr, paidAt: now }],
  });
}

export async function markEmployeeUnpaid(users: UserRepository, employeeId: string): Promise<User> {
  const employee = await users.findById(employeeId);
  if (!employee || employee.role !== UserRole.EMPLOYEE) {
    throw new NotFoundError("Employee not found");
  }
  const paidInr = rewardInr(employee.paidInr);
  const payouts = [...(employee.payouts ?? [])];
  const last = payouts.at(-1);
  if (paidInr <= 0 && !last) {
    throw new ConflictError("Nothing has been marked paid");
  }
  if (last) {
    payouts.pop();
  }
  return users.update({
    ...employee,
    paidInr: Math.max(0, paidInr - (last?.amountInr ?? paidInr)),
    payouts,
  });
}

export interface EmployeePayoutRow {
  id: string;
  name: string;
  email: string;
  active: boolean;
  cooldownUntil?: string;
  successRewardInr: number;
  todayPassed: number;
  overallPassed: number;
  earnedInr: number;
  paidInr: number;
  unpaidInr: number;
  hasPayoutQr: boolean;
  upiId?: string;
  lastPaidAt?: string;
}

export async function getAdminPayoutReport(
  users: UserRepository,
  payments: PaymentSessionRepository,
  now: Date,
  page: { offset: number; limit: number; q?: string; unpaidOnly?: boolean },
): Promise<{
  todayPassed: number;
  overallPassed: number;
  totalPayableInr: number;
  employees: EmployeePayoutRow[];
  total: number;
  hasMore: boolean;
}> {
  const [employees, todayGroups, overallGroups] = await Promise.all([
    users.listEmployeePayoutSources(),
    payments.countSuccessGrouped(startOfTodayIst(now)),
    payments.countSuccessGrouped(),
  ]);
  const todayById = new Map(todayGroups.map((row) => [row.employeeId, row.count]));
  const overallById = new Map(overallGroups.map((row) => [row.employeeId, row.count]));
  const rows = employees
    .map((employee) => {
      const rate = rewardInr(employee.successRewardInr);
      const overallPassed = overallById.get(employee.id) ?? 0;
      const earnedInr = overallPassed * rate;
      const paidInr = rewardInr(employee.paidInr);
      return {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        active: employee.active,
        cooldownUntil: isCoolingDown(employee, now) ? employee.cooldownUntil?.toISOString() : undefined,
        successRewardInr: rate,
        todayPassed: todayById.get(employee.id) ?? 0,
        overallPassed,
        earnedInr,
        paidInr,
        unpaidInr: Math.max(0, earnedInr - paidInr),
        hasPayoutQr: employee.hasPayoutQr === true,
        upiId: employee.upiId,
        lastPaidAt: employee.lastPaidAt?.toISOString(),
      };
    })
    .sort(
      (left, right) =>
        right.unpaidInr - left.unpaidInr || left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
    );
  const needle = page.q?.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (page.unpaidOnly && row.unpaidInr <= 0) return false;
    if (!needle) return true;
    return row.name.toLowerCase().includes(needle) || row.email.toLowerCase().includes(needle);
  });
  const employeesPage = filtered.slice(page.offset, page.offset + page.limit);
  return {
    todayPassed: rows.reduce((sum, row) => sum + row.todayPassed, 0),
    overallPassed: rows.reduce((sum, row) => sum + row.overallPassed, 0),
    totalPayableInr: rows.reduce((sum, row) => sum + row.unpaidInr, 0),
    employees: employeesPage,
    total: filtered.length,
    hasMore: page.offset + employeesPage.length < filtered.length,
  };
}
