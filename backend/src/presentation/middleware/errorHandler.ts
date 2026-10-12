import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { DomainError } from "../../domain/errors/DomainError";
import { logger } from "../../shared/logger/logger";

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof DomainError) {
    res.status(error.statusCode).json({ error: error.message, code: error.code });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: "Invalid request",
      details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
    return;
  }
  logger.error("request failed", { name: error instanceof Error ? error.name : "Error" });
  res.status(500).json({ error: "Internal server error" });
}
