import { Router } from "express";
import { UserRole } from "../../domain/enums/UserRole";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { PaymentUseCaseDeps } from "../../application/use-cases/CreatePaymentSession";
import { TokenService } from "../../infrastructure/auth/tokenService";
import { PaymentSseService } from "../../infrastructure/realtime/PaymentSseService";
import { createPaymentController } from "../controllers/PaymentController";
import { createAuthentication } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { privateNoStore, rateLimit } from "../middleware/http";

export function createInternalPaymentRoutes(
  deps: PaymentUseCaseDeps & { users: UserRepository; tokens: TokenService },
  sse: PaymentSseService,
): Router {
  const router = Router();
  const controller = createPaymentController(deps, sse);
  router.use(
    createAuthentication(deps.users, deps.tokens),
    authorize(UserRole.ADMIN, UserRole.EXTENSION_USER),
    privateNoStore,
    rateLimit(60, 60_000),
  );
  router.post("/", (req, res, next) => void controller.create(req, res, next));
  router.post("/heartbeat", (req, res, next) => void controller.heartbeat(req, res, next));
  router.patch("/:id/status", (req, res, next) => void controller.updateStatus(req, res, next));
  return router;
}
