import type { FastifyRequest, FastifyReply } from "fastify";
import { getAnomalies, getAnomalyById } from "./anomaly.service";
import { generateAIAnalysis } from "../ai/ai.service";
import { prisma } from "../../config/prisma";

export const getAnomaliesController = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const query = request.query as { page?: string; limit?: string };
  const page = Math.max(1, parseInt(query.page ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "20", 10)));

  const result = await getAnomalies(page, limit);
  reply.status(200).send(result);
};

export const getAnomalyByIdController = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const { id } = request.params as { id: string };
  const anomaly = await getAnomalyById(id);

  if (!anomaly) {
    return reply.status(404).send({ error: "Anomaly not found" });
  }

  reply.status(200).send(anomaly);
};

export const analyzeAnomalyController = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const { id } = request.params as { id: string };

  const anomaly = await prisma.anomaly.findUnique({ where: { id } });
  if (!anomaly) {
    return reply.status(404).send({ error: "Anomaly not found" });
  }

  const explanation = await generateAIAnalysis(id, {
    endpoint: anomaly.endpoint,
    type: anomaly.type as "LATENCY_SPIKE" | "ERROR_SPIKE",
    baseline: anomaly.baseline,
    current: anomaly.current,
  });

  reply.status(200).send({ aiExplanation: explanation });
};
