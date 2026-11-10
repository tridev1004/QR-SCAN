import cors from "cors";
import express from "express";
import { UserRepository } from "../domain/repositories/UserRepository";
import { PaymentUseCaseDeps } from "../application/use-cases/CreatePaymentSession";
import { TokenService } from "../infrastructure/auth/tokenService";
import { Mailer } from "../infrastructure/email/Mailer";
import { BroadcastRepository } from "../domain/repositories/BroadcastRepository";
import { InMemoryBroadcastRepository } from "../test/InMemoryBroadcastRepository";
import { PaymentEventBus } from "../infrastructure/realtime/PaymentEventBus";
import { PaymentSseService } from "../infrastructure/realtime/PaymentSseService";
import { PresenceService } from "../infrastructure/realtime/PresenceService";
import { errorHandler } from "./middleware/errorHandler";
import { privateNoStore, requestLog } from "./middleware/http";
import { createAdminRoutes } from "./routes/adminPaymentRoutes";
import { createAuthRoutes } from "./routes/authRoutes";
import { createInternalPaymentRoutes } from "./routes/internalPaymentRoutes";
import { createPaymentRoutes } from "./routes/paymentRoutes";
import { UserRole } from "../domain/enums/UserRole";
import { createAuthentication } from "./middleware/authentication";
import { authorize } from "./middleware/authorization";

const unconfiguredMailer: Mailer = {
  async sendVerification() {
    throw new Error("Email verification is not configured");
  },
};

export interface AppDeps extends PaymentUseCaseDeps {
  users: UserRepository;
  tokens: TokenService;
  events: PaymentEventBus;
  broadcasts?: BroadcastRepository;
  presence?: PresenceService;
  mailer?: Mailer;
  appPublicUrl?: string;
  corsOrigins?: string[];
}

function allowOrigin(origin: string | undefined, extraOrigins: string[]): boolean {
  if (!origin) {
    return true;
  }
  return (
    extraOrigins.includes(origin) ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:") ||
    origin.startsWith("chrome-extension://")
  );
}

export function createApp(deps: AppDeps) {
  const app = express();
  const presence = deps.presence ?? new PresenceService();
  const sse = new PaymentSseService(deps.events, presence);
  const appDeps = {
    ...deps,
    broadcasts: deps.broadcasts ?? new InMemoryBroadcastRepository(),
    presence,
  };
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, allowOrigin(origin, deps.corsOrigins ?? []));
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
  app.use("/api/payments", createPaymentRoutes(appDeps, sse));
  app.post(
    "/api/presence/heartbeat",
    createAuthentication(deps.users, deps.tokens),
    privateNoStore,
    authorize(UserRole.EMPLOYEE, UserRole.ADMIN, UserRole.PAYER, UserRole.SESSION_VIEWER),
    (req, res) => {
      presence.touch(req.user!);
      res.status(204).end();
    },
  );
  app.use("/api/admin", createAdminRoutes(appDeps));
  app.use(errorHandler);
  return app;
}
