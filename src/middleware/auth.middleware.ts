import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken } from "../modules/auth/auth.service";
import { validateApiKey } from "../modules/apikey/apikey.service";

export const authMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  // 1. Try session cookie first (browser dashboard)
  const accessToken = (request.cookies as Record<string, string | undefined>)["access_token"];
  if (accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);
      request.userId = payload.userId;
      return;
    } catch {
      // Fall through to API key check
    }
  }

  // 2. Try Authorization: Bearer <api-key> (programmatic access)
  const authHeader = request.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    const rawKey = authHeader.slice(7).trim();
    const result = await validateApiKey(rawKey);
    if (result) {
      request.userId = result.userId;
      return;
    }
  }

  return reply.status(401).send({ error: "Authentication required" });
};

// Extend FastifyRequest to include userId
declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}
