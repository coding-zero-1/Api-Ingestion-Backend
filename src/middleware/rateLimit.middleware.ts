import type { FastifyRequest, FastifyReply } from "fastify";
import { redis } from "../config/redis";

const RATE_LIMIT_WINDOW = 60; // 1 minute in seconds
const RATE_LIMIT_MAX = 20;

export const rateLimitMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const ip = request.ip;
  const route = request.routerPath ?? request.url;
  const key = `rate:${ip}:${route}`;

  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW);
  }

  const ttl = await redis.ttl(key);

  reply.header("X-RateLimit-Limit", RATE_LIMIT_MAX);
  reply.header("X-RateLimit-Remaining", Math.max(0, RATE_LIMIT_MAX - current));
  reply.header("X-RateLimit-Reset", ttl);

  if (current > RATE_LIMIT_MAX) {
    return reply.status(429).send({
      error: "Too many requests",
      retryAfter: ttl,
    });
  }
};
