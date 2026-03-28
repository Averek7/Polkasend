import { randomUUID } from "crypto";
import type { RequestHandler } from "express";
import { logger } from "../config/logger";

function sanitizePath(path: string): string {
  return path.split("?")[0] ?? path;
}

export const requestContext: RequestHandler = (req, res, next) => {
  const start = Date.now();
  const requestId = req.header("x-request-id") || randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    logger.info(
      `[${requestId}] ${req.method} ${sanitizePath(req.originalUrl)} -> ${res.statusCode} (${durationMs}ms)`,
    );
  });

  next();
};
