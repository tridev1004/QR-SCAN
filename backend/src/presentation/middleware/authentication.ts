import { NextFunction, Request, Response } from "express";
import { PublicUser, toPublicUser } from "../../domain/entities/User";
import { UserRole } from "../../domain/enums/UserRole";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { TokenService } from "../../infrastructure/auth/tokenService";

export function createAuthentication(users: UserRepository, tokens: TokenService) {
  return async function authentication(req: Request, res: Response, next: NextFunction) {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const verified = tokens.verify(header.slice("Bearer ".length).trim());
    if (!verified) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const user = await users.findById(verified.userId);
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (
      (user.role === UserRole.EMPLOYEE ||
        user.role === UserRole.EXTENSION_USER ||
        user.role === UserRole.PAYER ||
        user.role === UserRole.SESSION_VIEWER) &&
      !user.active
    ) {
      res.status(403).json({ error: "This account is inactive" });
      return;
    }
    const publicUser: PublicUser = toPublicUser(user);
    req.user = publicUser;
    next();
  };
}
