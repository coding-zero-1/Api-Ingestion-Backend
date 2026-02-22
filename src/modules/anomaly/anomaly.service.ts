import { prisma } from "../../config/prisma";
import { calculateP95, calculateMean, calculateStdDev, calculateErrorRate } from "../metrics/metrics.utils";
import { generateAIAnalysis } from "../ai/ai.service";

const LATENCY_STDDEV_THRESHOLD = 2;
const ERROR_RATE_THRESHOLD = 5; // 5%
const MIN_SAMPLES_FOR_DETECTION = 10;

type AnomalyType = "LATENCY_SPIKE" | "ERROR_SPIKE";

export type DetectedAnomaly = {
  endpoint: string;
  type: AnomalyType;
  baseline: number;
  current: number;
};

export const detectLatencySpike = (
  responseTimes: number[]
): { isAnomaly: boolean; baseline: number; current: number } => {
  if (responseTimes.length < MIN_SAMPLES_FOR_DETECTION) {
    return { isAnomaly: false, baseline: 0, current: 0 };
  }

  // Use all but last 10% as baseline, last 10% as current window
  const splitIndex = Math.floor(responseTimes.length * 0.9);
  const baseline = responseTimes.slice(0, splitIndex);
  const current = responseTimes.slice(splitIndex);

  const baselineMean = calculateMean(baseline);
  const baselineStdDev = calculateStdDev(baseline);
  const currentP95 = calculateP95(current);

  const threshold = baselineMean + LATENCY_STDDEV_THRESHOLD * baselineStdDev;
  const isAnomaly = currentP95 > threshold;

  return {
    isAnomaly,
    baseline: baselineMean,
    current: currentP95,
  };
};

export const detectErrorSpike = (
  statusCodes: number[]
): { isAnomaly: boolean; baseline: number; current: number } => {
  if (statusCodes.length < MIN_SAMPLES_FOR_DETECTION) {
    return { isAnomaly: false, baseline: 0, current: 0 };
  }

  const errorRate = calculateErrorRate(statusCodes);
  const isAnomaly = errorRate > ERROR_RATE_THRESHOLD;

  return {
    isAnomaly,
    baseline: ERROR_RATE_THRESHOLD,
    current: errorRate,
  };
};

export const runAnomalyDetection = async (endpoint: string): Promise<void> => {
  const logs = await prisma.log.findMany({
    where: { endpoint },
    orderBy: { timestamp: "asc" },
    take: 500,
    select: {
      responseTime: true,
      statusCode: true,
      timestamp: true,
    },
  });

  if (logs.length < MIN_SAMPLES_FOR_DETECTION) return;

  const responseTimes = logs.map((l) => l.responseTime);
  const statusCodes = logs.map((l) => l.statusCode);

  const latencyResult = detectLatencySpike(responseTimes);
  const errorResult = detectErrorSpike(statusCodes);

  const anomaliesToCreate: DetectedAnomaly[] = [];

  if (latencyResult.isAnomaly) {
    anomaliesToCreate.push({
      endpoint,
      type: "LATENCY_SPIKE",
      baseline: latencyResult.baseline,
      current: latencyResult.current,
    });
  }

  if (errorResult.isAnomaly) {
    anomaliesToCreate.push({
      endpoint,
      type: "ERROR_SPIKE",
      baseline: errorResult.baseline,
      current: errorResult.current,
    });
  }

  // Store anomalies and trigger AI analysis
  for (const anomalyData of anomaliesToCreate) {
    const anomaly = await prisma.anomaly.create({
      data: {
        endpoint: anomalyData.endpoint,
        type: anomalyData.type,
        baseline: anomalyData.baseline,
        current: anomalyData.current,
      },
    });

    // Trigger AI analysis asynchronously (don't await — fire and forget)
    generateAIAnalysis(anomaly.id, anomalyData).catch((err: unknown) => {
      console.error(`AI analysis failed for anomaly ${anomaly.id}:`, err);
    });
  }
};

export const getAnomalies = async (
  page: number,
  limit: number
): Promise<{ anomalies: unknown[]; total: number }> => {
  const skip = (page - 1) * limit;

  const [anomalies, total] = await Promise.all([
    prisma.anomaly.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.anomaly.count(),
  ]);

  return { anomalies, total };
};

export const getAnomalyById = async (id: string): Promise<unknown | null> => {
  return prisma.anomaly.findUnique({ where: { id } });
};
