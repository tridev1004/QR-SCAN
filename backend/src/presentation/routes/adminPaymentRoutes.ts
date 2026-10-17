import { Router } from "express";
import { UserRole } from "../../domain/enums/UserRole";
import { BroadcastRepository } from "../../domain/repositories/BroadcastRepository";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { PaymentUseCaseDeps } from "../../application/use-cases/CreatePaymentSession";
import { TokenService } from "../../infrastructure/auth/tokenService";
import { createAdminPaymentController } from "../controllers/AdminPaymentController";
import { createAuthentication } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { privateNoStore } from "../middleware/http";

export function createAdminRoutes(
  deps: PaymentUseCaseDeps & { users: UserRepository; tokens: TokenService; broadcasts: BroadcastRepository },
): Router {
  const router = Router();
  const controller = createAdminPaymentController(deps);
  router.use(createAuthentication(deps.users, deps.tokens), privateNoStore);
  router.get("/employees", authorize(UserRole.ADMIN, UserRole.EXTENSION_USER), (req, res, next) => void controller.employees(req, res, next));
  router.use(authorize(UserRole.ADMIN));
  router.get("/payments", (req, res, next) => void controller.list(req, res, next));
  router.get("/payouts", (req, res, next) => void controller.payouts(req, res, next));
  router.get("/extension-users", (req, res, next) => void controller.extensionUsers(req, res, next));
  router.get("/statistics", (req, res, next) => void controller.statistics(req, res, next));
  router.post("/broadcasts", (req, res, next) => void controller.publishBroadcast(req, res, next));
  router.delete("/broadcasts/:id", (req, res, next) => void controller.stopBroadcast(req, res, next));
  router.get("/employees/:id/payout-qr", (req, res, next) => void controller.payoutQr(req, res, next));
  router.post("/employees/:id/paid", (req, res, next) => void controller.markPaid(req, res, next));
  router.post("/employees/:id/unpaid", (req, res, next) => void controller.markUnpaid(req, res, next));
  router.post("/employees/:id/resume", (req, res, next) => void controller.clearPause(req, res, next));
  router.post("/employees", (req, res, next) => void controller.createEmployee(req, res, next));
  router.post("/employees/rewards", (req, res, next) => void controller.setRewards(req, res, next));
  router.post("/employees/delete", (req, res, next) => void controller.removeEmployees(req, res, next));
  router.patch("/employees/:id", (req, res, next) => void controller.setActive(req, res, next));
  router.patch("/employees/:id/password", (req, res, next) => void controller.setPassword(req, res, next));
  router.patch("/employees/:id/reward", (req, res, next) => void controller.setReward(req, res, next));
  router.delete("/employees/:id", (req, res, next) => void controller.removeEmployee(req, res, next));
  router.patch("/payments/:id/assign", (req, res, next) => void controller.assign(req, res, next));
  router.post("/payments/:id/cancel", (req, res, next) => void controller.cancel(req, res, next));
  return router;
}
