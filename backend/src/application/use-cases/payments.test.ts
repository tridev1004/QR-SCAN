import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { PaymentStatus } from "../../domain/enums/PaymentStatus";
import { UserRole } from "../../domain/enums/UserRole";
import { InvalidTransitionError } from "../../domain/errors/DomainError";
import { MemoryPaymentQrCache } from "../../infrastructure/cache/MemoryPaymentQrCache";
import { PaymentEventBus } from "../../infrastructure/realtime/PaymentEventBus";
import { InMemoryPaymentSessionRepository } from "../../test/InMemoryPaymentSessionRepository";
import { InMemoryUserRepository } from "../../test/InMemoryUserRepository";
import { createPaymentSession, PaymentUseCaseDeps } from "./CreatePaymentSession";
import { getEmployeeDashboard, getEmployeePayments, getPaymentQr, getPaymentSession, reservePaymentSession } from "./PaymentQueries";
import { ConflictError, ForbiddenError } from "../../domain/errors/DomainError";
import { clearEmployeePause, getAdminPayoutReport, getAdminStatistics, getExtensionUserStats, markEmployeePaid, markEmployeeUnpaid, markExtensionUserPaid, saveEmployeeUpiId } from "./EmployeeAccounts";
import { requireActiveEmployee } from "./ManageUsers";
import { expireDuePayments, updatePaymentStatus } from "./UpdatePaymentStatus";

const admin = { id: "admin", name: "Admin", email: "admin@company.local", role: UserRole.ADMIN, active: true };
const rahul = {
  id: "rahul",
  name: "Rahul",
  email: "rahul@company.local",
  passwordHash: "x",
  role: UserRole.EMPLOYEE,
  active: true,
};
const aman = {
  id: "aman",
  name: "Aman",
  email: "aman@company.local",
  passwordHash: "x",
  role: UserRole.EMPLOYEE,
  active: true,
};

function setup() {
  const payments = new InMemoryPaymentSessionRepository();
  const qrCache = new MemoryPaymentQrCache();
  const events = new PaymentEventBus();
  let current = new Date("2026-10-01T12:00:00.000Z");
  const deps: PaymentUseCaseDeps & { users: InMemoryUserRepository } = {
    payments,
    qrCache,
    events,
    users: new InMemoryUserRepository([rahul, aman]),
    now: () => {
      const value = new Date(current);
      current = new Date(current.getTime() + 1000);
      return value;
    },
  };
  return {
    deps,
    qrCache,
    events,
    setNow(date: Date) {
      current = date;
    },
  };
}

async function createQr(
  deps: PaymentUseCaseDeps,
  fingerprint: string,
  localSessionId = randomUUID(),
) {
  return createPaymentSession(deps, {
    localSessionId,
    qrFingerprint: fingerprint,
    qrImage: `data:image/png;base64,${fingerprint}`,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    assignedEmployeeId: rahul.id,
    createdByUserId: admin.id,
  });
}

describe("payment use cases", () => {
  it("creates a session and stores the QR outside the session record", async () => {
    const { deps, qrCache } = setup();
    const fingerprint = "a".repeat(64);
    const { session, created } = await createQr(deps, fingerprint);
    expect(created).toBe(true);
    expect(session.status).toBe(PaymentStatus.QR_READY);
    expect(session.code).toBe("PAY-001");
    expect(session).not.toHaveProperty("qrImage");
    expect(await qrCache.get(session.id)).toContain("base64");
  });

  it("does not create a second session for the same active QR", async () => {
    const { deps } = setup();
    const fingerprint = "b".repeat(64);
    const first = await createQr(deps, fingerprint, "local-1");
    const second = await createQr(deps, fingerprint, "local-2");
    expect(second.created).toBe(false);
    expect(second.session.id).toBe(first.session.id);
    expect(await deps.payments.listAll({})).toHaveLength(1);
  });

  it("keeps sequential QR codes as separate sessions", async () => {
    const { deps } = setup();
    const ids = [];
    for (const char of ["c", "d", "e", "f", "a"]) {
      const result = await createQr(deps, char.repeat(64));
      ids.push(result.session.id);
    }
    expect(new Set(ids).size).toBe(5);
    expect((await deps.payments.listAll({})).map((item) => item.code)).toEqual([
      "PAY-005",
      "PAY-004",
      "PAY-003",
      "PAY-002",
      "PAY-001",
    ]);
  });

  it("verifies the mailbox on the payment that succeeded, not another open session", async () => {
    const verified: string[] = [];
    const { deps } = setup();
    deps.mailVerify = {
      async verifyAddress(address: string) {
        verified.push(address);
      },
    };
    const first = await createPaymentSession(deps, {
      localSessionId: randomUUID(),
      qrFingerprint: "b".repeat(64),
      qrImage: "data:image/png;base64,one",
      accountEmail: "one@biski.org",
      assignedEmployeeId: rahul.id,
      createdByUserId: admin.id,
    });
    const second = await createPaymentSession(deps, {
      localSessionId: randomUUID(),
      qrFingerprint: "c".repeat(64),
      qrImage: "data:image/png;base64,two",
      accountEmail: "two@biski.org",
      assignedEmployeeId: rahul.id,
      createdByUserId: admin.id,
    });
    await updatePaymentStatus(deps, first.session.id, PaymentStatus.WAITING_FOR_PAYMENT);
    await updatePaymentStatus(deps, second.session.id, PaymentStatus.WAITING_FOR_PAYMENT);
    await updatePaymentStatus(deps, second.session.id, PaymentStatus.SUCCESS);
    await updatePaymentStatus(deps, first.session.id, PaymentStatus.SUCCESS);
    expect(verified).toEqual(["two@biski.org", "one@biski.org"]);
  });

  it("does not guess a mailbox when the payment has no account email", async () => {
    const verified: string[] = [];
    const { deps } = setup();
    deps.mailVerify = {
      async verifyAddress(address: string) {
        verified.push(address);
      },
    };
    const { session } = await createQr(deps, "d".repeat(64));
    await updatePaymentStatus(deps, session.id, PaymentStatus.WAITING_FOR_PAYMENT);
    await updatePaymentStatus(deps, session.id, PaymentStatus.SUCCESS);
    expect(verified).toEqual([]);
  });

  it("rejects an invalid status change and allows terminal idempotency", async () => {
    const { deps, qrCache } = setup();
    const { session } = await createQr(deps, "1".repeat(64));
    await updatePaymentStatus(deps, session.id, PaymentStatus.WAITING_FOR_PAYMENT);
    const success = await updatePaymentStatus(deps, session.id, PaymentStatus.SUCCESS);
    expect(success.status).toBe(PaymentStatus.SUCCESS);
    expect(await qrCache.get(session.id)).toBeNull();
    const again = await updatePaymentStatus(deps, session.id, PaymentStatus.SUCCESS);
    expect(again.status).toBe(PaymentStatus.SUCCESS);
    await expect(updatePaymentStatus(deps, session.id, PaymentStatus.WAITING_FOR_PAYMENT)).rejects.toBeInstanceOf(
      InvalidTransitionError,
    );
  });

  it("keeps EXPIRED when a later FAILED update arrives", async () => {
    const { deps } = setup();
    const { session } = await createQr(deps, "9".repeat(64));
    await updatePaymentStatus(deps, session.id, PaymentStatus.WAITING_FOR_PAYMENT);
    await updatePaymentStatus(deps, session.id, PaymentStatus.EXPIRED);
    const again = await updatePaymentStatus(deps, session.id, PaymentStatus.FAILED, "Transaction wasn't completed");
    expect(again.status).toBe(PaymentStatus.EXPIRED);
  });

  it("expires due sessions and removes their QR", async () => {
    const { deps, qrCache, setNow } = setup();
    const { session } = await createQr(deps, "2".repeat(64));
    setNow(new Date(Date.now() + 10 * 60 * 1000));
    expect(await expireDuePayments(deps)).toBe(1);
    expect((await deps.payments.findById(session.id))?.status).toBe(PaymentStatus.EXPIRED);
    expect(await qrCache.get(session.id)).toBeNull();
  });

  it("lets only the assigned employee open a captured QR", async () => {
    const { deps } = setup();
    const { session } = await createQr(deps, "3".repeat(64));
    const rahulViewer = {
      id: rahul.id,
      name: rahul.name,
      email: rahul.email,
      role: rahul.role,
      active: true,
      successRewardInr: 0,
    };
    const amanViewer = {
      id: aman.id,
      name: aman.name,
      email: aman.email,
      role: aman.role,
      active: true,
      successRewardInr: 0,
    };
    expect((await getPaymentSession(deps, rahulViewer, session.id)).code).toBe(session.code);
    expect(await getPaymentQr(deps, rahulViewer, session.id)).toContain("base64");
    await expect(getPaymentSession(deps, amanViewer, session.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await getEmployeePayments(deps, rahul.id)).map((item) => item.id)).toEqual([session.id]);
    expect(await getEmployeePayments(deps, aman.id)).toEqual([]);
  });

  it("lets one employee reserve a shared QR and hides it from the other", async () => {
    const { deps } = setup();
    const fingerprint = "c".repeat(64);
    const { session } = await createPaymentSession(deps, {
      localSessionId: randomUUID(),
      broadcast: true,
      qrFingerprint: fingerprint,
      qrImage: `data:image/png;base64,${fingerprint}`,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdByUserId: admin.id,
    });
    const rahulViewer = {
      id: rahul.id,
      name: rahul.name,
      email: rahul.email,
      role: rahul.role,
      active: true,
      successRewardInr: 0,
    };
    expect((await getEmployeePayments(deps, rahul.id)).map((item) => item.id)).toContain(session.id);
    expect((await getEmployeePayments(deps, aman.id)).map((item) => item.id)).toContain(session.id);
    await expect(getPaymentQr(deps, rahulViewer, session.id)).rejects.toBeInstanceOf(ForbiddenError);

    const [first, second] = await Promise.all([
      reservePaymentSession(deps, session.id, rahul.id).then(
        (saved) => saved,
        () => null,
      ),
      reservePaymentSession(deps, session.id, aman.id).then(
        (saved) => saved,
        (error: unknown) => {
          expect(error).toBeInstanceOf(ConflictError);
          return null;
        },
      ),
    ]);
    const winner = first ?? second;
    const loser = first ? second : first;
    expect(winner?.assignedEmployeeId).toBeTruthy();
    expect(loser).toBeNull();
    const visibleToRahul = (await getEmployeePayments(deps, rahul.id)).map((item) => item.id);
    const visibleToAman = (await getEmployeePayments(deps, aman.id)).map((item) => item.id);
    const parallel = await Promise.all([
      createPaymentSession(deps, {
        localSessionId: randomUUID(),
        assignedEmployeeId: rahul.id,
        qrFingerprint: "d".repeat(64),
        qrImage: `data:image/png;base64,${"d".repeat(64)}`,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        createdByUserId: admin.id,
      }),
      createPaymentSession(deps, {
        localSessionId: randomUUID(),
        assignedEmployeeId: aman.id,
        qrFingerprint: "e".repeat(64),
        qrImage: `data:image/png;base64,${"e".repeat(64)}`,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        createdByUserId: admin.id,
      }),
    ]);
    const rahulLive = await getEmployeeDashboard(deps, rahul, { offset: 0, limit: 8 });
    const amanLive = await getEmployeeDashboard(deps, aman, { offset: 0, limit: 8 });
    expect(rahulLive.live.map((item) => item.id)).toContain(parallel[0].session.id);
    expect(rahulLive.live.map((item) => item.id)).not.toContain(parallel[1].session.id);
    expect(amanLive.live.map((item) => item.id)).toContain(parallel[1].session.id);
    expect(amanLive.live.map((item) => item.id)).not.toContain(parallel[0].session.id);

    if (winner?.assignedEmployeeId === rahul.id) {
      expect(visibleToRahul).toContain(session.id);
      expect(visibleToAman).not.toContain(session.id);
      expect(await getPaymentQr(deps, rahulViewer, session.id)).toContain("base64");
    } else {
      expect(visibleToAman).toContain(session.id);
      expect(visibleToRahul).not.toContain(session.id);
    }
  });

  it("pauses an employee for 3 hours after two consecutive failed or expired QRs and records a payout", async () => {
    const { deps, setNow } = setup();
    setNow(new Date());
    const first = await createQr(deps, "1".repeat(64));
    await updatePaymentStatus(deps, first.session.id, PaymentStatus.FAILED, "failed");
    expect((await deps.users.findById(rahul.id))?.cooldownUntil).toBeUndefined();

    const passed = await createQr(deps, "2".repeat(64));
    await updatePaymentStatus(deps, passed.session.id, PaymentStatus.WAITING_FOR_PAYMENT);
    await updatePaymentStatus(deps, passed.session.id, PaymentStatus.SUCCESS);
    const afterSuccess = await createQr(deps, "3".repeat(64));
    await updatePaymentStatus(deps, afterSuccess.session.id, PaymentStatus.EXPIRED);
    expect((await deps.users.findById(rahul.id))?.cooldownUntil).toBeUndefined();

    const second = await createQr(deps, "4".repeat(64));
    await updatePaymentStatus(deps, second.session.id, PaymentStatus.FAILED, "failed");
    const paused = await deps.users.findById(rahul.id);
    expect(paused?.cooldownUntil && paused.cooldownUntil.getTime()).toBeGreaterThan(Date.now());
    await expect(requireActiveEmployee(deps.users, rahul.id)).rejects.toBeInstanceOf(ForbiddenError);

    const resetAt = deps.now();
    await clearEmployeePause(deps.users, rahul.id, resetAt);
    await expect(requireActiveEmployee(deps.users, rahul.id)).resolves.toMatchObject({ id: rahul.id });
    const later = await createQr(deps, "5".repeat(64));
    await updatePaymentStatus(deps, later.session.id, PaymentStatus.FAILED, "failed");
    expect((await deps.users.findById(rahul.id))?.cooldownUntil).toBeUndefined();

    await deps.users.update({ ...rahul, successRewardInr: 40, cooldownUntil: new Date(0), strikeResetAt: new Date() });
    const { session } = await createQr(deps, "4".repeat(64));
    await updatePaymentStatus(deps, session.id, PaymentStatus.WAITING_FOR_PAYMENT);
    await updatePaymentStatus(deps, session.id, PaymentStatus.SUCCESS);
    const paid = await markEmployeePaid(deps.users, deps.payments, rahul.id, new Date("2026-10-01T18:00:00.000Z"));
    expect(paid.paidInr).toBe(80);
    expect(paid.payouts?.[0]?.amountInr).toBe(80);
    const unpaid = await markEmployeeUnpaid(deps.users, rahul.id);
    expect(unpaid.paidInr).toBe(0);
    expect(unpaid.payouts).toEqual([]);
  });

  it("lists unpaid employees first and pages the payout search", async () => {
    const { deps } = setup();
    await deps.users.update({ ...rahul, successRewardInr: 40 });
    await deps.users.update({ ...aman, successRewardInr: 40, paidInr: 40 });
    const { session } = await createQr(deps, "5".repeat(64));
    await updatePaymentStatus(deps, session.id, PaymentStatus.WAITING_FOR_PAYMENT);
    await updatePaymentStatus(deps, session.id, PaymentStatus.SUCCESS);

    const first = await getAdminPayoutReport(deps.users, deps.payments, deps.now(), { offset: 0, limit: 1 });
    expect(first.employees.map((row) => row.id)).toEqual([rahul.id]);
    expect(first.total).toBe(2);
    expect(first.hasMore).toBe(true);
    expect(first.totalPayableInr).toBe(40);

    const unpaid = await getAdminPayoutReport(deps.users, deps.payments, deps.now(), {
      offset: 0,
      limit: 8,
      unpaidOnly: true,
    });
    expect(unpaid.employees.map((row) => row.id)).toEqual([rahul.id]);
    expect(unpaid.total).toBe(1);

    const search = await getAdminPayoutReport(deps.users, deps.payments, deps.now(), { offset: 0, limit: 8, q: "ama" });
    expect(search.employees.map((row) => row.id)).toEqual([aman.id]);
    expect(search.totalPayableInr).toBe(40);

    await saveEmployeeUpiId(deps.users, rahul.id, "rahul@okbank");
    const withUpi = await getAdminPayoutReport(deps.users, deps.payments, deps.now(), { offset: 0, limit: 8, q: "rahul" });
    expect(withUpi.employees[0]?.upiId).toBe("rahul@okbank");
  });

  it("lets an employee reserve only two QRs until one is finished", async () => {
    const { deps } = setup();
    const ids: string[] = [];
    for (const digit of ["6", "7", "8"]) {
      const { session } = await createPaymentSession(deps, {
        localSessionId: randomUUID(),
        broadcast: true,
        qrFingerprint: digit.repeat(64),
        qrImage: `data:image/png;base64,${digit.repeat(64)}`,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        createdByUserId: admin.id,
      });
      ids.push(session.id);
    }
    await reservePaymentSession(deps, ids[0], rahul.id);
    await reservePaymentSession(deps, ids[1], rahul.id);
    await expect(reservePaymentSession(deps, ids[2], rahul.id)).rejects.toBeInstanceOf(ConflictError);
    expect((await deps.payments.findById(ids[2]))?.assignedEmployeeId).toBeUndefined();

    await updatePaymentStatus(deps, ids[0], PaymentStatus.WAITING_FOR_PAYMENT);
    await updatePaymentStatus(deps, ids[0], PaymentStatus.SUCCESS);
    const third = await reservePaymentSession(deps, ids[2], rahul.id);
    expect(third.assignedEmployeeId).toBe(rahul.id);
  });

  it("counts passed and failed QRs sent by an extension user", async () => {
    const { deps } = setup();
    await deps.users.create({
      id: "ext",
      name: "Scanner",
      email: "scanner@company.local",
      passwordHash: "x",
      role: UserRole.EXTENSION_USER,
      active: true,
      successRewardInr: 40,
    });
    const passed = await createPaymentSession(deps, {
      localSessionId: randomUUID(),
      qrFingerprint: "9".repeat(64),
      qrImage: "data:image/png;base64,abc",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      assignedEmployeeId: rahul.id,
      createdByUserId: "ext",
    });
    await updatePaymentStatus(deps, passed.session.id, PaymentStatus.WAITING_FOR_PAYMENT);
    await updatePaymentStatus(deps, passed.session.id, PaymentStatus.SUCCESS);
    const failed = await createPaymentSession(deps, {
      localSessionId: randomUUID(),
      qrFingerprint: "a".repeat(63) + "b",
      qrImage: "data:image/png;base64,def",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      assignedEmployeeId: rahul.id,
      createdByUserId: "ext",
    });
    await updatePaymentStatus(deps, failed.session.id, PaymentStatus.WAITING_FOR_PAYMENT);
    await updatePaymentStatus(deps, failed.session.id, PaymentStatus.FAILED, "failed");

    const report = await getExtensionUserStats(deps.users, deps.payments);
    expect(report.users).toEqual([
      expect.objectContaining({ id: "ext", passedCount: 1, failedCount: 1, earnedInr: 40, successRewardInr: 40, paidInr: 0, unpaidInr: 40 }),
    ]);
    const day = {
      from: new Date("2026-10-01T00:00:00+05:30"),
      to: new Date("2026-10-02T00:00:00+05:30"),
    };
    const today = await getExtensionUserStats(deps.users, deps.payments, day);
    expect(today.users[0]).toMatchObject({ passedCount: 1, failedCount: 1, earnedInr: 40, unpaidInr: 40 });
    await markExtensionUserPaid(deps.users, deps.payments, "ext", day, new Date("2026-10-01T18:00:00.000Z"));
    const paid = await getExtensionUserStats(deps.users, deps.payments, day);
    expect(paid.users[0]).toMatchObject({ paidInr: 40, unpaidInr: 0 });
    expect(paid.paidInr).toBe(40);
    const otherDays = await getExtensionUserStats(deps.users, deps.payments, {
      from: new Date("2026-10-02T00:00:00+05:30"),
      to: new Date("2026-10-04T00:00:00+05:30"),
    });
    expect(otherDays.users[0]).toMatchObject({ earnedInr: 0, paidInr: 0, unpaidInr: 0 });
  });

  it("summarizes passed, failed, expired, paid, and unpaid inside a date range", async () => {
    const { deps } = setup();
    await deps.users.update({ ...rahul, successRewardInr: 40 });
    const passed = await createQr(deps, "b".repeat(64));
    await updatePaymentStatus(deps, passed.session.id, PaymentStatus.WAITING_FOR_PAYMENT);
    await updatePaymentStatus(deps, passed.session.id, PaymentStatus.SUCCESS);
    const failed = await createQr(deps, "c".repeat(64));
    await updatePaymentStatus(deps, failed.session.id, PaymentStatus.FAILED, "failed");
    const expired = await createQr(deps, "d".repeat(64));
    await updatePaymentStatus(deps, expired.session.id, PaymentStatus.EXPIRED);
    await deps.users.update({
      ...(await deps.users.findById(rahul.id))!,
      payouts: [{ amountInr: 20, paidAt: new Date("2026-10-01T18:00:00.000Z") }],
      paidInr: 20,
    });

    const stats = await getAdminStatistics(
      deps.users,
      deps.payments,
      new Date("2026-10-01T00:00:00+05:30"),
      new Date("2026-10-02T00:00:00+05:30"),
    );
    expect(stats).toMatchObject({ passed: 1, failed: 1, expired: 1, paidInr: 20, unpaidInr: 20 });
  });
});
