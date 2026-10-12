import { Router } from "express";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { Mailer } from "../../infrastructure/email/Mailer";
import { TokenService } from "../../infrastructure/auth/tokenService";
import { createAuthController } from "../controllers/AuthController";
import { createAuthentication } from "../middleware/authentication";
import { rateLimit } from "../middleware/http";

export function createAuthRoutes(
  users: UserRepository,
  tokens: TokenService,
  mailer: Mailer,
  appPublicUrl: string,
): Router {
  const router = Router();
  const controller = createAuthController(users, tokens, mailer, appPublicUrl);
  const authenticate = createAuthentication(users, tokens);
  router.post("/login", (req, res, next) => void controller.login(req, res, next));
  router.post("/signup/check", rateLimit(10, 60_000), (req, res, next) => void controller.checkSignupEmail(req, res, next));
  router.post("/signup", rateLimit(5, 60_000), (req, res, next) => void controller.signup(req, res, next));
  router.post("/verify-email", rateLimit(10, 60_000), (req, res, next) => void controller.verifyEmail(req, res, next));
  router.get("/me", authenticate, (req, res) => controller.me(req, res));
  return router;
}
