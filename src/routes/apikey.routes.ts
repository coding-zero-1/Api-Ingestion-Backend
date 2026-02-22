import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  createApiKeyController,
  listApiKeysController,
  revokeApiKeyController,
} from "../modules/apikey/apikey.controller";

export const apiKeyRoutes = async (fastify: FastifyInstance): Promise<void> => {
  fastify.post("/auth/api-keys", {
    preHandler: [authMiddleware],
    handler: createApiKeyController,
  });

  fastify.get("/auth/api-keys", {
    preHandler: [authMiddleware],
    handler: listApiKeysController,
  });

  fastify.delete("/auth/api-keys/:id", {
    preHandler: [authMiddleware],
    handler: revokeApiKeyController,
  });
};
