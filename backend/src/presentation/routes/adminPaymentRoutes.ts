import { Router } from "express";
import { UserRole } from "../../domain/enums/UserRole";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { PaymentUseCaseDeps } from "../../application/use-cases/CreatePaymentSession";
import { TokenService } from "../../infrastructure/auth/tokenService";
import { createAdminPaymentController } from "../controllers/AdminPaymentController";
import { createAuthentication } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { privateNoStore } from "../middleware/http";

export function createAdminRoutes(
  deps: PaymentUseCaseDeps & { users: UserRepository; tokens: TokenService },
): Router {
  const router = Router();
  const controller = createAdminPaymentController(deps);
  router.use(createAuthentication(deps.users, deps.tokens), authorize(UserRole.ADMIN), privateNoStore);
  router.get("/payments", (req, res, next) => void controller.list(req, res, next));
  router.get("/employees", (req, res, next) => void controller.employees(req, res, next));
  router.post("/employees", (req, res, next) => void controller.createEmployee(req, res, next));
  router.patch("/employees/:id", (req, res, next) => void controller.setActive(req, res, next));
  router.patch("/employees/:id/password", (req, res, next) => void controller.setPassword(req, res, next));
  router.patch("/employees/:id/reward", (req, res, next) => void controller.setReward(req, res, next));
  router.delete("/employees/:id", (req, res, next) => void controller.removeEmployee(req, res, next));
  router.patch("/payments/:id/assign", (req, res, next) => void controller.assign(req, res, next));
  router.post("/payments/:id/cancel", (req, res, next) => void controller.cancel(req, res, next));
  return router;
}
