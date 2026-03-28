import { createHash } from "crypto";
import type { RequestHandler } from "express";

type CachedResponse = {
  expiresAt: number;
  bodyHash: string;
  statusCode: number;
  payload: unknown;
};

const cache = new Map<string, CachedResponse>();
const DEFAULT_TTL_MS = 15 * 60 * 1000;

function payloadHash(body: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(body ?? {}))
    .digest("hex");
}

function pruneExpired(now: number) {
  for (const [key, value] of cache.entries()) {
    if (value.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

export function idempotency(ttlMs = DEFAULT_TTL_MS): RequestHandler {
  return (req, res, next) => {
    const key = req.header("idempotency-key");
    if (!key) {
      return next();
    }

    const now = Date.now();
    pruneExpired(now);

    const resourceKey = `${req.method}:${req.originalUrl}:${key}`;
    const bodyHash = payloadHash(req.body);
    const existing = cache.get(resourceKey);

    if (existing) {
      if (existing.bodyHash !== bodyHash) {
        return res.status(409).json({
          success: false,
          error: "Idempotency key reused with different request payload",
        });
      }

      return res.status(existing.statusCode).json(existing.payload);
    }

    const originalJson = res.json.bind(res);
    res.json = ((payload: unknown) => {
      cache.set(resourceKey, {
        expiresAt: now + ttlMs,
        bodyHash,
        statusCode: res.statusCode,
        payload,
      });
      return originalJson(payload);
    }) as typeof res.json;

    next();
  };
}
