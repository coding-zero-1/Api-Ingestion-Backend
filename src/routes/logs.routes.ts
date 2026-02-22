import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { rateLimitMiddleware } from "../middleware/rateLimit.middleware";
import { batchLogsController, getLogsController } from "../modules/logs/logs.controller";

export const logsRoutes = async (fastify: FastifyInstance): Promise<void> => {
  fastify.post("/logs/batch", {
    preHandler: [authMiddleware, rateLimitMiddleware],
    handler: batchLogsController,
  });

  fastify.get("/logs", {
    preHandler: [authMiddleware],
    handler: getLogsController,
  });
};
