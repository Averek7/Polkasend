import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../config/logger";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: "Not found",
    path: req.originalUrl,
    requestId: res.locals.requestId,
  });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const requestId = res.locals.requestId as string | undefined;
  const statusCode =
    typeof (err as { status?: unknown })?.status === "number"
      ? ((err as { status: number }).status as number)
      : 500;
  const message =
    statusCode >= 500 ? "Internal server error" : (err as Error).message;

  logger.error(
    `[${requestId ?? "n/a"}] ${statusCode} ${(err as Error).name}: ${(err as Error).message}`,
    err,
  );

  res.status(statusCode).json({
    success: false,
    error: message,
    requestId,
  });
};
