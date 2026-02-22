import { GoogleGenerativeAI } from "@google/generative-ai";
import crypto from "crypto";
import { env } from "../../config/env";
import { redis } from "../../config/redis";
import { prisma } from "../../config/prisma";
import type { DetectedAnomaly } from "../anomaly/anomaly.service";

const AI_CACHE_TTL = 60 * 60 * 24; // 24 hours

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const buildPrompt = (anomaly: DetectedAnomaly): string => {
  const anomalyDescription =
    anomaly.type === "LATENCY_SPIKE"
      ? `Latency spike detected on endpoint "${anomaly.endpoint}". Baseline average latency: ${anomaly.baseline.toFixed(2)}ms. Current P95 latency: ${anomaly.current.toFixed(2)}ms (${((anomaly.current / anomaly.baseline - 1) * 100).toFixed(1)}% above baseline).`
      : `Error rate spike detected on endpoint "${anomaly.endpoint}". Normal threshold: ${anomaly.baseline}%. Current error rate: ${anomaly.current.toFixed(2)}%.`;

  return `You are an expert backend engineer and SRE. Analyze the following API performance anomaly and provide a structured root cause analysis.

ANOMALY DETAILS:
${anomalyDescription}

Provide a concise analysis with EXACTLY these 5 sections:

1. LIKELY ROOT CAUSE
Identify the most probable cause of this anomaly.

2. DATABASE OPTIMIZATION SUGGESTION
Suggest specific database-level optimizations (indexes, query optimization, connection pooling, etc.).

3. CODE-LEVEL SUGGESTION
Suggest specific code changes that could resolve or prevent this issue.

4. INFRASTRUCTURE SUGGESTION
Recommend infrastructure or configuration changes (caching, load balancing, resource scaling, etc.).

5. SCALING RECOMMENDATION
Provide actionable scaling strategies for this specific endpoint and traffic pattern.

Be specific, technical, and actionable. Keep each section to 2-3 sentences maximum.`;
};

const buildCacheKey = (anomaly: DetectedAnomaly): string => {
  const hash = crypto
    .createHash("sha256")
    .update(
      `${anomaly.endpoint}:${anomaly.type}:${anomaly.baseline.toFixed(0)}:${anomaly.current.toFixed(0)}`,
    )
    .digest("hex")
    .substring(0, 16);
  return `ai:analysis:${hash}`;
};

export const generateAIAnalysis = async (
  anomalyId: string,
  anomaly: DetectedAnomaly,
): Promise<string> => {
  const cacheKey = buildCacheKey(anomaly);

  // Check Redis cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    // Update the DB record with the cached explanation
    await prisma.anomaly.update({
      where: { id: anomalyId },
      data: { aiExplanation: cached },
    });
    return cached;
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    generationConfig: {
      temperature: 0.2,
    },
  });

  const prompt = buildPrompt(anomaly);
  const result = await model.generateContent(prompt);
  const explanation = result.response.text();

  // Cache in Redis
  await redis.setex(cacheKey, AI_CACHE_TTL, explanation);

  // Store in database
  await prisma.anomaly.update({
    where: { id: anomalyId },
    data: { aiExplanation: explanation },
  });

  return explanation;
};
