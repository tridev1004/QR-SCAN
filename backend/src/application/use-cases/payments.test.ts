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
import { getEmployeePayments, getPaymentQr, getPaymentSession } from "./PaymentQueries";
import { ForbiddenError } from "../../domain/errors/DomainError";
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
});
