import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  getMetricsController,
  getMetricsHistoryController,
  getGlobalSummaryController,
} from "../modules/metrics/metrics.controller";

export const metricsRoutes = async (fastify: FastifyInstance): Promise<void> => {
  fastify.get("/metrics", {
    preHandler: [authMiddleware],
    handler: getMetricsController,
  });

  fastify.get("/metrics/summary", {
    preHandler: [authMiddleware],
    handler: getGlobalSummaryController,
  });

  fastify.get("/metrics/:endpoint", {
    preHandler: [authMiddleware],
    handler: getMetricsHistoryController,
  });
};
