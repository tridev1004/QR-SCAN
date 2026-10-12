import { Router } from "express";
import { UserRole } from "../../domain/enums/UserRole";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { PaymentUseCaseDeps } from "../../application/use-cases/CreatePaymentSession";
import { TokenService } from "../../infrastructure/auth/tokenService";
import { PaymentSseService } from "../../infrastructure/realtime/PaymentSseService";
import { createPaymentController } from "../controllers/PaymentController";
import { createAuthentication } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { privateNoStore } from "../middleware/http";

export function createPaymentRoutes(
  deps: PaymentUseCaseDeps & { users: UserRepository; tokens: TokenService },
  sse: PaymentSseService,
): Router {
  const router = Router();
  const controller = createPaymentController(deps, sse);
  router.use(createAuthentication(deps.users, deps.tokens), privateNoStore);
  router.get("/events", (req, res) => controller.events(req, res));
  router.get("/", authorize(UserRole.EMPLOYEE, UserRole.ADMIN), (req, res, next) => {
    void controller.listMine(req, res, next);
  });
  router.get("/:id/qr", (req, res, next) => void controller.getQr(req, res, next));
  router.get("/:id/events", (req, res) => controller.events(req, res, String(req.params.id)));
  router.get("/:id", (req, res, next) => void controller.getOne(req, res, next));
  return router;
}
