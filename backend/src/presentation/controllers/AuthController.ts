import { NextFunction, Request, Response } from "express";
import { toPublicUser } from "../../domain/entities/User";
import { UserRole } from "../../domain/enums/UserRole";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { assertSignupEmailAvailable, signupEmployee, verifySignupEmail } from "../../application/use-cases/Signup";
import { verifyPassword } from "../../infrastructure/auth/password";
import { Mailer } from "../../infrastructure/email/Mailer";
import { TokenService } from "../../infrastructure/auth/tokenService";
import { loginSchema, signupEmailSchema, signupSchema, verifyEmailSchema } from "../validation";

export function createAuthController(
  users: UserRepository,
  tokens: TokenService,
  mailer: Mailer,
  appPublicUrl: string,
) {
  return {
    async login(req: Request, res: Response, next: NextFunction) {
      try {
        const body = loginSchema.parse(req.body);
        const user = await users.findByEmail(body.email);
        if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
          res.status(401).json({ error: "Invalid email or password" });
          return;
        }
        if (body.portal === "employee" && user.role !== UserRole.EMPLOYEE) {
          res.status(403).json({
            error: user.role === UserRole.EXTENSION_USER ? "Extension accounts sign in from the extension" : "Use the admin sign-in",
          });
          return;
        }
        if (body.portal === "admin" && user.role !== UserRole.ADMIN) {
          res.status(403).json({
            error:
              user.role === UserRole.EXTENSION_USER
                ? "Extension accounts cannot use the admin dashboard"
                : "Use the employee sign-in",
          });
          return;
        }
        if (body.portal === "extension" && user.role !== UserRole.ADMIN && user.role !== UserRole.EXTENSION_USER) {
          res.status(403).json({ error: "Sign in with an admin or extension account" });
          return;
        }
        if (user.role === UserRole.EMPLOYEE && user.emailVerified === false) {
          res.status(403).json({ error: "Confirm your email before signing in" });
          return;
        }
        if ((user.role === UserRole.EMPLOYEE || user.role === UserRole.EXTENSION_USER) && !user.active) {
          res.status(403).json({ error: "This account is inactive" });
          return;
        }
        const publicUser = toPublicUser(user);
        res.json({ token: tokens.sign(publicUser), user: publicUser });
      } catch (error) {
        next(error);
      }
    },
    async checkSignupEmail(req: Request, res: Response, next: NextFunction) {
      try {
        const body = signupEmailSchema.parse(req.body);
        await assertSignupEmailAvailable(users, body.email);
        res.json({ available: true });
      } catch (error) {
        next(error);
      }
    },
    async signup(req: Request, res: Response, next: NextFunction) {
      try {
        const body = signupSchema.parse(req.body);
        await signupEmployee(users, mailer, body, appPublicUrl, new Date());
        res.status(201).json({ email: body.email.toLowerCase() });
      } catch (error) {
        next(error);
      }
    },
    async verifyEmail(req: Request, res: Response, next: NextFunction) {
      try {
        const body = verifyEmailSchema.parse(req.body);
        await verifySignupEmail(users, body.token, new Date());
        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
    me(req: Request, res: Response) {
      res.json({ user: req.user });
    },
  };
}
