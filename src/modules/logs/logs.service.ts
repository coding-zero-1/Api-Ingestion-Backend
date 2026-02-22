import { prisma } from "../../config/prisma";
import { recalculateMetrics } from "../metrics/metrics.service";
import { runAnomalyDetection } from "../anomaly/anomaly.service";
import type { BatchLogsInput } from "./logs.schema";

export const ingestBatchLogs = async (input: BatchLogsInput): Promise<{ count: number }> => {
  const data = input.logs.map((log) => ({
    endpoint: log.endpoint,
    method: log.method,
    statusCode: log.statusCode,
    responseTime: log.responseTime,
    dbQueryTime: log.dbQueryTime ?? null,
    timestamp: new Date(log.timestamp),
  }));

  await prisma.log.createMany({ data });

  // Get unique endpoints from this batch
  const endpoints = [...new Set(input.logs.map((l) => l.endpoint))];

  // Recalculate metrics and run anomaly detection for affected endpoints
  for (const endpoint of endpoints) {
    await recalculateMetrics(endpoint);
    await runAnomalyDetection(endpoint);
  }

  return { count: data.length };
};

export const getLogs = async (
  page: number,
  limit: number,
  endpoint?: string
): Promise<{ logs: unknown[]; total: number }> => {
  const where = endpoint ? { endpoint } : {};
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.log.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip,
      take: limit,
    }),
    prisma.log.count({ where }),
  ]);

  return { logs, total };
};
