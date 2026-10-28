import { NextFunction, Request, Response } from "express";
import { logger } from "../../shared/logger/logger";

export function privateNoStore(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Cache-Control", "no-store, private");
  next();
}

export function requestLog(req: Request, res: Response, next: NextFunction) {
  const path = req.originalUrl.split("?")[0];
  if (!path.startsWith("/api")) {
    next();
    return;
  }
  if (path.endsWith("/events")) {
    logger.info("request", { method: req.method, path, status: 200 });
    next();
    return;
  }
  res.on("finish", () => {
    logger.info("request", { method: req.method, path, status: res.statusCode });
  });
  next();
}
