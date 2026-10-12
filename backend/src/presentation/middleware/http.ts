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

export function rateLimit(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return function limitRequests(req: Request, res: Response, next: NextFunction) {
    const key = req.user?.id ?? req.ip ?? "anonymous";
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
    if (recent.length >= limit) {
      res.status(429).json({ error: "Too many requests" });
      return;
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}
