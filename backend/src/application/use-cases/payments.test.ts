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
import { getAdminPayoutReport, markEmployeePaid, markEmployeeUnpaid, saveEmployeeUpiId } from "./EmployeeAccounts";
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

  it("pauses an employee for 3 hours after three failed QRs and records a payout", async () => {
    const { deps, setNow } = setup();
    setNow(new Date());
    for (const digit of ["1", "2", "3"]) {
      const { session } = await createQr(deps, digit.repeat(64));
      await updatePaymentStatus(deps, session.id, PaymentStatus.WAITING_FOR_PAYMENT);
      await updatePaymentStatus(deps, session.id, PaymentStatus.FAILED, "failed");
    }
    const paused = await deps.users.findById(rahul.id);
    expect(paused?.cooldownUntil && paused.cooldownUntil.getTime()).toBeGreaterThan(Date.now());
    await expect(requireActiveEmployee(deps.users, rahul.id)).rejects.toBeInstanceOf(ForbiddenError);

    await deps.users.update({ ...rahul, successRewardInr: 40, cooldownUntil: new Date(0), strikeResetAt: new Date() });
    const { session } = await createQr(deps, "4".repeat(64));
    await updatePaymentStatus(deps, session.id, PaymentStatus.WAITING_FOR_PAYMENT);
    await updatePaymentStatus(deps, session.id, PaymentStatus.SUCCESS);
    const paid = await markEmployeePaid(deps.users, deps.payments, rahul.id, new Date("2026-10-01T18:00:00.000Z"));
    expect(paid.paidInr).toBe(40);
    expect(paid.payouts?.[0]?.amountInr).toBe(40);
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
});
