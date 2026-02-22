import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { rateLimitMiddleware } from "../middleware/rateLimit.middleware";
import {
  getAnomaliesController,
  getAnomalyByIdController,
  analyzeAnomalyController,
} from "../modules/anomaly/anomaly.controller";

export const anomalyRoutes = async (fastify: FastifyInstance): Promise<void> => {
  fastify.get("/anomalies", {
    preHandler: [authMiddleware],
    handler: getAnomaliesController,
  });

  fastify.get("/anomalies/:id", {
    preHandler: [authMiddleware],
    handler: getAnomalyByIdController,
  });

  fastify.post("/anomalies/:id/analyze", {
    preHandler: [authMiddleware, rateLimitMiddleware],
    handler: analyzeAnomalyController,
  });
};
