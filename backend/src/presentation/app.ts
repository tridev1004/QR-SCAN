import cors from "cors";
import express from "express";
import { UserRepository } from "../domain/repositories/UserRepository";
import { PaymentUseCaseDeps } from "../application/use-cases/CreatePaymentSession";
import { TokenService } from "../infrastructure/auth/tokenService";
import { Mailer } from "../infrastructure/email/Mailer";
import { PaymentEventBus } from "../infrastructure/realtime/PaymentEventBus";
import { PaymentSseService } from "../infrastructure/realtime/PaymentSseService";
import { errorHandler } from "./middleware/errorHandler";
import { requestLog } from "./middleware/http";
import { createAdminRoutes } from "./routes/adminPaymentRoutes";
import { createAuthRoutes } from "./routes/authRoutes";
import { createInternalPaymentRoutes } from "./routes/internalPaymentRoutes";
import { createPaymentRoutes } from "./routes/paymentRoutes";

const unconfiguredMailer: Mailer = {
  async sendVerification() {
    throw new Error("Email verification is not configured");
  },
};

export interface AppDeps extends PaymentUseCaseDeps {
  users: UserRepository;
  tokens: TokenService;
  events: PaymentEventBus;
  mailer?: Mailer;
  appPublicUrl?: string;
}

function allowOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }
  return (
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:") ||
    origin.startsWith("chrome-extension://")
  );
}

export function createApp(deps: AppDeps) {
  const app = express();
  const sse = new PaymentSseService(deps.events);
  app.disable("x-powered-by");
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, allowOrigin(origin));
      },
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(requestLog);
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use(
    "/api/auth",
    createAuthRoutes(deps.users, deps.tokens, deps.mailer ?? unconfiguredMailer, deps.appPublicUrl ?? "http://localhost:5174"),
  );
  app.use("/api/internal/payment-sessions", createInternalPaymentRoutes(deps, sse));
  app.use("/api/payments", createPaymentRoutes(deps, sse));
  app.use("/api/admin", createAdminRoutes(deps));
  app.use(errorHandler);
  return app;
}
