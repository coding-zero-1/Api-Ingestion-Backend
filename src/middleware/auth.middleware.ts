import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken } from "../modules/auth/auth.service";

export const authMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const accessToken = (request.cookies as Record<string, string | undefined>)["access_token"];

  if (!accessToken) {
    return reply.status(401).send({ error: "Authentication required" });
  }

  try {
    const payload = verifyAccessToken(accessToken);
    request.userId = payload.userId;
  } catch {
    return reply.status(401).send({ error: "Invalid or expired access token" });
  }
};

// Extend FastifyRequest to include userId
declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}
