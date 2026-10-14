import { randomUUID } from "crypto";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "../domain/enums/UserRole";
import { hashPassword } from "../infrastructure/auth/password";
import { createTokenService } from "../infrastructure/auth/tokenService";
import { MemoryPaymentQrCache } from "../infrastructure/cache/MemoryPaymentQrCache";
import { PaymentEventBus } from "../infrastructure/realtime/PaymentEventBus";
import { createApp } from "../presentation/app";
import { InMemoryPaymentSessionRepository } from "../test/InMemoryPaymentSessionRepository";
import { InMemoryUserRepository } from "../test/InMemoryUserRepository";

const admin = {
  id: randomUUID(),
  name: "Admin",
  email: "admin@company.local",
  passwordHash: "",
  role: UserRole.ADMIN,
  active: true,
};
const rahul = {
  id: randomUUID(),
  name: "Rahul",
  email: "rahul@company.local",
  passwordHash: "",
  role: UserRole.EMPLOYEE,
  active: true,
};
const aman = {
  id: randomUUID(),
  name: "Aman",
  email: "aman@company.local",
  passwordHash: "",
  role: UserRole.EMPLOYEE,
  active: true,
};

describe("payment http api", () => {
  const tokens = createTokenService("test-secret", "1h");
  const users = new InMemoryUserRepository();
  const app = createApp({
    users,
    payments: new InMemoryPaymentSessionRepository(),
    qrCache: new MemoryPaymentQrCache(),
    events: new PaymentEventBus(),
    tokens,
    now: () => new Date("2026-10-01T12:00:00.000Z"),
  });

  beforeAll(async () => {
    admin.passwordHash = await hashPassword("admin123");
    rahul.passwordHash = await hashPassword("employee123");
    aman.passwordHash = await hashPassword("employee123");
    await users.create(admin);
    await users.create(rahul);
    await users.create(aman);
  });

  async function login(email: string, password: string, portal: "admin" | "employee") {
    const response = await request(app).post("/api/auth/login").send({ email, password, portal });
    expect(response.status).toBe(200);
    return response.body.token as string;
  }

  it("keeps employee QR access limited to the assigned session", async () => {
    const adminToken = await login(admin.email, "admin123", "admin");
    const rahulToken = await login(rahul.email, "employee123", "employee");
    const amanToken = await login(aman.email, "employee123", "employee");
    const fingerprint = "ab".repeat(32);
    const created = await request(app)
      .post("/api/internal/payment-sessions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        localSessionId: randomUUID(),
        assignedEmployeeId: rahul.id,
        qrFingerprint: fingerprint,
        qrImage: "data:image/png;base64,aaaa",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("QR_READY");
    const id = created.body.paymentSessionId as string;

    const duplicate = await request(app)
      .post("/api/internal/payment-sessions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        localSessionId: randomUUID(),
        assignedEmployeeId: rahul.id,
        qrFingerprint: fingerprint,
        qrImage: "data:image/png;base64,aaaa",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.paymentSessionId).toBe(id);

    expect(
      (
        await request(app)
          .post("/api/internal/payment-sessions")
          .set("Authorization", `Bearer ${rahulToken}`)
          .send({
            localSessionId: randomUUID(),
            qrFingerprint: "cd".repeat(32),
            qrImage: "data:image/png;base64,bbbb",
            expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          })
      ).status,
    ).toBe(403);

    expect((await request(app).get(`/api/payments/${id}`).set("Authorization", `Bearer ${rahulToken}`)).status).toBe(200);
    const qr = await request(app).get(`/api/payments/${id}/qr`).set("Authorization", `Bearer ${rahulToken}`);
    expect(qr.status).toBe(200);
    expect(qr.headers["cache-control"]).toContain("no-store");
    expect(qr.body.qrImage).toContain("base64");
    expect((await request(app).get(`/api/payments/${id}/qr`).set("Authorization", `Bearer ${amanToken}`)).status).toBe(403);

    const waiting = await request(app)
      .patch(`/api/internal/payment-sessions/${id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "WAITING_FOR_PAYMENT" });
    expect(waiting.body.status).toBe("WAITING_FOR_PAYMENT");
    const live = await request(app).get("/api/payments").set("Authorization", `Bearer ${rahulToken}`);
    expect(live.body.live).toHaveLength(1);

    const success = await request(app)
      .patch(`/api/internal/payment-sessions/${id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "SUCCESS" });
    expect(success.body.status).toBe("SUCCESS");
    expect(
      (
        await request(app)
          .patch(`/api/internal/payment-sessions/${id}/status`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ status: "EXPIRED" })
      ).status,
    ).toBe(409);
    expect((await request(app).get(`/api/payments/${id}/qr`).set("Authorization", `Bearer ${rahulToken}`)).status).toBe(404);

    const adminList = await request(app).get("/api/admin/payments").set("Authorization", `Bearer ${adminToken}`);
    expect(adminList.body.payments).toHaveLength(1);
    const employeeList = await request(app).get("/api/payments").set("Authorization", `Bearer ${rahulToken}`);
    expect(employeeList.body.payments).toEqual([expect.objectContaining({ status: "SUCCESS" })]);
    const otherList = await request(app).get("/api/payments").set("Authorization", `Bearer ${amanToken}`);
    expect(otherList.body.payments).toEqual([]);
  });

  it("lets an admin create an employee and mark that account inactive", async () => {
    const adminToken = await login(admin.email, "admin123", "admin");
    const created = await request(app)
      .post("/api/admin/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Neha", email: "neha@company.local", password: "neha123" });
    expect(created.status).toBe(201);
    expect(created.body.employee).toMatchObject({
      name: "Neha",
      email: "neha@company.local",
      role: "EMPLOYEE",
      active: true,
      successRewardInr: 40,
    });

    const employeeLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "neha@company.local", password: "neha123", portal: "employee" });
    expect(employeeLogin.status).toBe(200);

    const changed = await request(app)
      .patch(`/api/admin/employees/${created.body.employee.id}/password`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ password: "neha456" });
    expect(changed.status).toBe(204);
    expect(
      (await request(app).post("/api/auth/login").send({ email: "neha@company.local", password: "neha123", portal: "employee" }))
        .status,
    ).toBe(401);
    expect(
      (await request(app).post("/api/auth/login").send({ email: "neha@company.local", password: "neha456", portal: "employee" }))
        .status,
    ).toBe(200);

    const wrongPortal = await request(app)
      .post("/api/auth/login")
      .send({ email: admin.email, password: "admin123", portal: "employee" });
    expect(wrongPortal.status).toBe(403);

    const inactive = await request(app)
      .patch(`/api/admin/employees/${created.body.employee.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: false });
    expect(inactive.status).toBe(200);
    expect(inactive.body.employee.active).toBe(false);

    const blocked = await request(app)
      .post("/api/auth/login")
      .send({ email: "neha@company.local", password: "neha456", portal: "employee" });
    expect(blocked.status).toBe(403);

    const list = await request(app).get("/api/admin/employees").set("Authorization", `Bearer ${adminToken}`);
    const neha = (list.body.employees as Array<{ email: string; active: boolean }>).find(
      (employee) => employee.email === "neha@company.local",
    );
    expect(neha?.active).toBe(false);

    const refused = await request(app)
      .post("/api/internal/payment-sessions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        localSessionId: randomUUID(),
        assignedEmployeeId: created.body.employee.id,
        qrFingerprint: "ef".repeat(32),
        qrImage: "data:image/png;base64,cccc",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    expect(refused.status).toBe(404);

    const removed = await request(app)
      .delete(`/api/admin/employees/${created.body.employee.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(removed.status).toBe(204);
    const afterDelete = await request(app).get("/api/admin/employees").set("Authorization", `Bearer ${adminToken}`);
    expect(
      (afterDelete.body.employees as Array<{ email: string }>).some((employee) => employee.email === "neha@company.local"),
    ).toBe(false);
    const gone = await request(app)
      .post("/api/auth/login")
      .send({ email: "neha@company.local", password: "neha123", portal: "employee" });
    expect(gone.status).toBe(401);
  });

  it("blocks a signed-in employee from admin routes", async () => {
    const rahulToken = await login(rahul.email, "employee123", "employee");
    expect((await request(app).get("/api/admin/employees").set("Authorization", `Bearer ${rahulToken}`)).status).toBe(403);
    expect((await request(app).get("/api/admin/payments").set("Authorization", `Bearer ${rahulToken}`)).status).toBe(403);
    expect((await request(app).delete(`/api/admin/employees/${aman.id}`).set("Authorization", `Bearer ${rahulToken}`)).status).toBe(403);
    expect(
      (
        await request(app)
          .patch(`/api/admin/employees/${aman.id}/password`)
          .set("Authorization", `Bearer ${rahulToken}`)
          .send({ password: "changed1" })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post("/api/admin/employees")
          .set("Authorization", `Bearer ${rahulToken}`)
          .send({ name: "Extra", email: "extra@company.local", password: "secret1" })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .patch(`/api/admin/employees/${aman.id}/reward`)
          .set("Authorization", `Bearer ${rahulToken}`)
          .send({ successRewardInr: 50 })
      ).status,
    ).toBe(403);
  });

  it("pays only passed QRs using the reward stored for that employee", async () => {
    const adminToken = await login(admin.email, "admin123", "admin");
    const rahulToken = await login(rahul.email, "employee123", "employee");
    const reward = await request(app)
      .patch(`/api/admin/employees/${rahul.id}/reward`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ successRewardInr: 50 });
    expect(reward.status).toBe(200);
    expect(reward.body.employee.successRewardInr).toBe(50);

    async function openQr(fingerprint: string) {
      const created = await request(app)
        .post("/api/internal/payment-sessions")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          localSessionId: randomUUID(),
          assignedEmployeeId: rahul.id,
          qrFingerprint: fingerprint,
          qrImage: "data:image/png;base64,dddd",
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        });
      expect(created.status).toBe(201);
      const id = created.body.paymentSessionId as string;
      expect(
        (
          await request(app)
            .patch(`/api/internal/payment-sessions/${id}/status`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ status: "WAITING_FOR_PAYMENT" })
        ).status,
      ).toBe(200);
      return id;
    }

    const passedId = await openQr("11".repeat(32));
    const failedId = await openQr("22".repeat(32));
    expect(
      (
        await request(app)
          .patch(`/api/internal/payment-sessions/${passedId}/status`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ status: "SUCCESS" })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .patch(`/api/internal/payment-sessions/${failedId}/status`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ status: "FAILED" })
      ).status,
    ).toBe(200);

    const mine = await request(app).get("/api/payments").set("Authorization", `Bearer ${rahulToken}`);
    expect(mine.status).toBe(200);
    const statuses = (mine.body.payments as Array<{ status: string }>).map((payment) => payment.status);
    expect(statuses).toContain("SUCCESS");
    expect(statuses).toContain("FAILED");
    const passedCount = statuses.filter((status) => status === "SUCCESS").length;
    expect(mine.body.earnings).toEqual({
      successRewardInr: 50,
      passedCount,
      failedCount: statuses.filter((status) => status === "FAILED").length,
      earnedInr: passedCount * 50,
    });
  });
});
