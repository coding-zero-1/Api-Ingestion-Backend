import type { FastifyRequest, FastifyReply } from "fastify";
import { batchLogsSchema } from "./logs.schema";
import { ingestBatchLogs, getLogs } from "./logs.service";

export const batchLogsController = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const parsed = batchLogsSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
  }

  const result = await ingestBatchLogs(parsed.data);
  reply.status(201).send({ message: "Logs ingested successfully", count: result.count });
};

export const getLogsController = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const query = request.query as { page?: string; limit?: string; endpoint?: string };
  const page = Math.max(1, parseInt(query.page ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "50", 10)));
  const endpoint = query.endpoint;

  const result = await getLogs(page, limit, endpoint);
  reply.status(200).send(result);
};
