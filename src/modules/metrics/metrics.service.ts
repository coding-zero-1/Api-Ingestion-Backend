import { prisma } from "../../config/prisma";
import {
  calculateAverageLatency,
  calculateP95,
  calculateErrorRate,
  calculateThroughput,
} from "./metrics.utils";

export type MetricResult = {
  endpoint: string;
  avgLatency: number;
  p95: number;
  errorRate: number;
  rps: number;
};

export const recalculateMetrics = async (endpoint: string): Promise<MetricResult> => {
  // Use last 1000 logs for the endpoint
  const logs = await prisma.log.findMany({
    where: { endpoint },
    orderBy: { timestamp: "desc" },
    take: 1000,
    select: {
      responseTime: true,
      statusCode: true,
      timestamp: true,
    },
  });

  const responseTimes = logs.map((l) => l.responseTime);
  const statusCodes = logs.map((l) => l.statusCode);
  const timestamps = logs.map((l) => l.timestamp);

  const avgLatency = calculateAverageLatency(responseTimes);
  const p95 = calculateP95(responseTimes);
  const errorRate = calculateErrorRate(statusCodes);
  const rps = calculateThroughput(timestamps, 60);

  await prisma.metricSnapshot.create({
    data: {
      endpoint,
      avgLatency,
      p95,
      errorRate,
      rps,
    },
  });

  return { endpoint, avgLatency, p95, errorRate, rps };
};

export const getLatestMetrics = async (): Promise<MetricResult[]> => {
  // Get the latest snapshot per endpoint using a subquery approach
  const endpoints = await prisma.metricSnapshot.findMany({
    select: { endpoint: true },
    distinct: ["endpoint"],
  });

  const results: MetricResult[] = [];

  for (const { endpoint } of endpoints) {
    const latest = await prisma.metricSnapshot.findFirst({
      where: { endpoint },
      orderBy: { createdAt: "desc" },
    });
    if (latest) {
      results.push({
        endpoint: latest.endpoint,
        avgLatency: latest.avgLatency,
        p95: latest.p95,
        errorRate: latest.errorRate,
        rps: latest.rps,
      });
    }
  }

  return results;
};

export const getMetricsHistory = async (
  endpoint: string,
  limit: number = 50
): Promise<MetricResult[]> => {
  const snapshots = await prisma.metricSnapshot.findMany({
    where: { endpoint },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return snapshots.map((s) => ({
    endpoint: s.endpoint,
    avgLatency: s.avgLatency,
    p95: s.p95,
    errorRate: s.errorRate,
    rps: s.rps,
  }));
};

export const getGlobalSummary = async (): Promise<{
  totalEndpoints: number;
  totalRequests: number;
  avgErrorRate: number;
  avgLatency: number;
}> => {
  const [totalRequests, metrics] = await Promise.all([
    prisma.log.count(),
    getLatestMetrics(),
  ]);

  const totalEndpoints = metrics.length;
  const avgErrorRate =
    metrics.length > 0
      ? metrics.reduce((acc, m) => acc + m.errorRate, 0) / metrics.length
      : 0;
  const avgLatency =
    metrics.length > 0
      ? metrics.reduce((acc, m) => acc + m.avgLatency, 0) / metrics.length
      : 0;

  return { totalEndpoints, totalRequests, avgErrorRate, avgLatency };
};
