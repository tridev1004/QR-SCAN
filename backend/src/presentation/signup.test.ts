import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTokenService } from "../infrastructure/auth/tokenService";
import { MemoryPaymentQrCache } from "../infrastructure/cache/MemoryPaymentQrCache";
import { PaymentEventBus } from "../infrastructure/realtime/PaymentEventBus";
import { createApp } from "../presentation/app";
import { InMemoryPaymentSessionRepository } from "../test/InMemoryPaymentSessionRepository";
import { InMemoryUserRepository } from "../test/InMemoryUserRepository";

describe("employee signup verification", () => {
  const sent: string[] = [];
  const app = createApp({
    users: new InMemoryUserRepository(),
    payments: new InMemoryPaymentSessionRepository(),
    qrCache: new MemoryPaymentQrCache(),
    events: new PaymentEventBus(),
    tokens: createTokenService("test-secret", "1h"),
    now: () => new Date("2026-10-01T12:00:00.000Z"),
    appPublicUrl: "http://localhost:5174",
    mailer: {
      async sendVerification(message) {
        sent.push(message.verifyUrl);
      },
    },
  });

  it("keeps a new account closed until the email link is confirmed", async () => {
    const signup = await request(app).post("/api/auth/signup").send({
      name: "Neha",
      email: "neha@company.local",
      password: "neha123",
    });
    expect(signup.status).toBe(201);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain("http://localhost:5174/verify-email?token=");

    const blocked = await request(app)
      .post("/api/auth/login")
      .send({ email: "neha@company.local", password: "neha123", portal: "employee" });
    expect(blocked.status).toBe(403);

    const token = new URL(sent[0]).searchParams.get("token");
    const verified = await request(app).post("/api/auth/verify-email").send({ token });
    expect(verified.status).toBe(200);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "neha@company.local", password: "neha123", portal: "employee" });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe("EMPLOYEE");

    const reused = await request(app).post("/api/auth/verify-email").send({ token });
    expect(reused.status).toBe(200);
    const missing = await request(app).post("/api/auth/verify-email").send({ token: "a".repeat(24) });
    expect(missing.status).toBe(400);

    const taken = await request(app).post("/api/auth/signup/check").send({ email: "neha@company.local" });
    expect(taken.status).toBe(409);
    const duplicate = await request(app).post("/api/auth/signup").send({
      name: "Neha",
      email: "neha@company.local",
      password: "neha123",
    });
    expect(duplicate.status).toBe(409);
    expect(sent).toHaveLength(1);
  });

  it("rejects an email that is not a full address", async () => {
    const before = sent.length;
    const signup = await request(app).post("/api/auth/signup").send({
      name: "Neha",
      email: "not-an-email",
      password: "neha123",
    });
    expect(signup.status).toBe(400);

    const missingDomain = await request(app).post("/api/auth/signup/check").send({ email: "user@gmail" });
    expect(missingDomain.status).toBe(400);
    expect(sent).toHaveLength(before);
  });

  it("rejects a disposable email address", async () => {
    const before = sent.length;
    const check = await request(app).post("/api/auth/signup/check").send({ email: "user@mailinator.com" });
    expect(check.status).toBe(400);
    expect(check.body.error).toBe("Temporary email addresses are not allowed");
    const signup = await request(app).post("/api/auth/signup").send({
      name: "Temp",
      email: "user@mailinator.com",
      password: "secret1",
    });
    expect(signup.status).toBe(400);
    expect(signup.body.error).toBe("Temporary email addresses are not allowed");
    expect(sent).toHaveLength(before);
  });
});

describe("signup ip limit", () => {
  it("allows three accounts from one ip then blocks the fourth", async () => {
    const app = createApp({
      users: new InMemoryUserRepository(),
      payments: new InMemoryPaymentSessionRepository(),
      qrCache: new MemoryPaymentQrCache(),
      events: new PaymentEventBus(),
      tokens: createTokenService("test-secret", "1h"),
      now: () => new Date("2026-10-01T12:00:00.000Z"),
      appPublicUrl: "http://localhost:5174",
      mailer: {
        async sendVerification() {
          return;
        },
      },
    });

    for (const n of [1, 2, 3]) {
      const created = await request(app).post("/api/auth/signup").send({
        name: `User ${n}`,
        email: `user${n}@company.local`,
        password: "secret1",
      });
      expect(created.status).toBe(201);
    }

    const blocked = await request(app).post("/api/auth/signup").send({
      name: "User 4",
      email: "user4@company.local",
      password: "secret1",
    });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe("This network has already created too many accounts");

    const otherIp = await request(app)
      .post("/api/auth/signup")
      .set("X-Forwarded-For", "203.0.113.10")
      .send({
        name: "Other",
        email: "other@company.local",
        password: "secret1",
      });
    expect(otherIp.status).toBe(201);
  });
});
