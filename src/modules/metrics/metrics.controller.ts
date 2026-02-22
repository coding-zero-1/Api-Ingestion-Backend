import type { FastifyRequest, FastifyReply } from "fastify";
import { getLatestMetrics, getMetricsHistory, getGlobalSummary } from "./metrics.service";

export const getMetricsController = async (
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const metrics = await getLatestMetrics();
  reply.status(200).send({ metrics });
};

export const getMetricsHistoryController = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const { endpoint } = request.params as { endpoint: string };
  const query = request.query as { limit?: string };
  const limit = Math.min(200, Math.max(1, parseInt(query.limit ?? "50", 10)));

  const history = await getMetricsHistory(decodeURIComponent(endpoint), limit);
  reply.status(200).send({ history });
};

export const getGlobalSummaryController = async (
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const summary = await getGlobalSummary();
  reply.status(200).send(summary);
};
