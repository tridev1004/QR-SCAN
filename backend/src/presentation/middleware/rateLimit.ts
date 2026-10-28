import { rateLimit, type Options, type RateLimitRequestHandler } from "express-rate-limit";

const jsonTooMany: Partial<Options> = {
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler(req, res, _next, options) {
    const message = typeof options.message === "string" ? options.message : "Too many requests";
    res.status(options.statusCode).json({ error: message });
  },
};

export function createRateLimit(limit: number, windowMs: number): RateLimitRequestHandler {
  return rateLimit({
    ...jsonTooMany,
    windowMs,
    limit,
    message: "Too many requests",
  });
}

export function createSignupIpLimit(): RateLimitRequestHandler {
  return rateLimit({
    ...jsonTooMany,
    windowMs: 24 * 60 * 60 * 1000,
    limit: 3,
    skipFailedRequests: true,
    message: "This network has already created too many accounts",
  });
}
