import { randomUUID } from "crypto";
import { UserRole } from "./domain/enums/UserRole";
import { hashPassword } from "./infrastructure/auth/password";
import { createResendMailer } from "./infrastructure/email/resendMailer";
import { createTokenService } from "./infrastructure/auth/tokenService";
import { MongoPaymentQrCache } from "./infrastructure/cache/MongoPaymentQrCache";
import { connectMongo } from "./infrastructure/persistence/mongo";
import { BroadcastRepositoryImpl } from "./infrastructure/persistence/repositories/BroadcastRepositoryImpl";
import { PaymentSessionRepositoryImpl } from "./infrastructure/persistence/repositories/PaymentSessionRepositoryImpl";
import { UserRepositoryImpl } from "./infrastructure/persistence/repositories/UserRepositoryImpl";
import { PaymentEventBus } from "./infrastructure/realtime/PaymentEventBus";
import { expireDuePayments } from "./application/use-cases/UpdatePaymentStatus";
import { createApp } from "./presentation/app";
import { env } from "./shared/config/env";
import { logger } from "./shared/logger/logger";
import { UserRepository } from "./domain/repositories/UserRepository";

async function seedUsers(users: UserRepository) {
  if (!env.seedOnStart) {
    return;
  }
  const people = [
    [env.adminName, env.adminEmail, env.adminPassword, UserRole.ADMIN],
  ] as const;

  for (const [name, email, password, role] of people) {
    if (await users.findByEmail(email)) {
      continue;
    }
    try {
      await users.create({
        id: randomUUID(),
        name,
        email,
        passwordHash: await hashPassword(password),
        role,
        active: true,
        emailVerified: true,
      });
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: number }).code : undefined;
      if (code !== 11000) {
        throw error;
      }
    }
  }
}

async function main() {
  await connectMongo(env.mongoUri);
  const users = new UserRepositoryImpl();
  const payments = new PaymentSessionRepositoryImpl();
  const qrCache = new MongoPaymentQrCache();
  const events = new PaymentEventBus();
  const tokens = createTokenService(env.jwtSecret, env.jwtTtl);
  await seedUsers(users);

  const deps = {
    users,
    payments,
    qrCache,
    events,
    broadcasts: new BroadcastRepositoryImpl(),
    tokens,
    now: () => new Date(),
    mailer: createResendMailer(env.resendApiKey, env.resendFrom),
    appPublicUrl: env.appPublicUrl,
    corsOrigins: env.corsOrigins,
  };
  const app = createApp(deps);
  const timer = setInterval(() => {
    expireDuePayments(deps).catch((error: unknown) => {
      logger.error("expiry sweep failed", { name: error instanceof Error ? error.name : "Error" });
    });
  }, 15_000);

  const server = app.listen(env.port, env.host, () => {
    logger.info("api listening", { port: env.port, host: env.host });
  });

  const shutdown = () => {
    clearInterval(timer);
    server.close();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message.replace(/\/\/([^/@\s]+)@/, "//") : "Error";
  logger.error("startup failed", { message });
  process.exit(1);
});
