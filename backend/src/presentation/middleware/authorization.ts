import { NextFunction, Request, Response } from "express";
import { UserRole } from "../../domain/enums/UserRole";

export function authorize(...roles: UserRole[]) {
  return function authorization(req: Request, res: Response, next: NextFunction) {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "You do not have access to this action" });
      return;
    }
    next();
  };
}
