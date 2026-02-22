import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const ENDPOINTS = [
  "/api/users",
  "/api/products",
  "/api/orders",
  "/api/payments",
  "/api/search",
];

const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;

const randomBetween = (min: number, max: number): number =>
  Math.random() * (max - min) + min;

const randomInt = (min: number, max: number): number =>
  Math.floor(randomBetween(min, max));

const randomChoice = <T>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)] as T;

const generateStatusCode = (isErrorBatch: boolean): number => {
  if (isErrorBatch && Math.random() < 0.3) {
    return randomChoice([400, 401, 404, 422, 500, 503]);
  }
  return randomChoice([200, 200, 200, 200, 201, 204]);
};

const generateLog = (
  endpoint: string,
  isLatencySpike: boolean,
  isErrorBatch: boolean,
  baseTime: Date
): {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  dbQueryTime: number | null;
  timestamp: Date;
} => {
  const baseLatency = isLatencySpike ? randomBetween(800, 3000) : randomBetween(20, 200);
  const jitter = randomBetween(-10, 10);
  const responseTime = Math.max(1, baseLatency + jitter);
  const dbQueryTime = Math.random() > 0.3 ? responseTime * randomBetween(0.3, 0.7) : null;

  return {
    endpoint,
    method: randomChoice(METHODS),
    statusCode: generateStatusCode(isErrorBatch),
    responseTime,
    dbQueryTime,
    timestamp: new Date(baseTime.getTime() + randomInt(0, 60000)),
  };
};

const seed = async () => {
  console.log("Seeding database...");

  // Create a demo user
  const hashedPassword = await bcrypt.hash("password123", 12);
  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      password: hashedPassword,
    },
  });
  console.log(`Demo user: ${user.email} (password: password123)`);

  // Clear existing logs and metrics
  await prisma.anomaly.deleteMany();
  await prisma.metricSnapshot.deleteMany();
  await prisma.log.deleteMany();
  console.log("Cleared existing data.");

  const now = new Date();
  const logs: {
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    dbQueryTime: number | null;
    timestamp: Date;
  }[] = [];

  // Generate 200 logs per endpoint over the last 2 hours
  for (const endpoint of ENDPOINTS) {
    for (let i = 0; i < 200; i++) {
      const minutesAgo = randomInt(0, 120);
      const baseTime = new Date(now.getTime() - minutesAgo * 60000);

      // Last 10 requests per endpoint — inject anomaly on /api/payments
      const isLatencySpike = endpoint === "/api/payments" && i >= 190;
      const isErrorBatch = endpoint === "/api/search" && i >= 185;

      logs.push(generateLog(endpoint, isLatencySpike, isErrorBatch, baseTime));
    }
  }

  // Batch insert
  await prisma.log.createMany({ data: logs });
  console.log(`Inserted ${logs.length} log entries.`);

  // Create metric snapshots per endpoint
  for (const endpoint of ENDPOINTS) {
    const endpointLogs = logs.filter((l) => l.endpoint === endpoint);
    const responseTimes = endpointLogs.map((l) => l.responseTime).sort((a, b) => a - b);
    const statusCodes = endpointLogs.map((l) => l.statusCode);
    const avgLatency =
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const p95Index = Math.ceil(responseTimes.length * 0.95) - 1;
    const p95 = responseTimes[Math.max(0, p95Index)] ?? 0;
    const errorCount = statusCodes.filter((c) => c >= 400).length;
    const errorRate = (errorCount / statusCodes.length) * 100;

    await prisma.metricSnapshot.create({
      data: {
        endpoint,
        avgLatency,
        p95,
        errorRate,
        rps: endpointLogs.length / 7200, // logs over 2 hours
      },
    });
  }
  console.log("Created metric snapshots.");

  // Create sample anomalies
  await prisma.anomaly.create({
    data: {
      endpoint: "/api/payments",
      type: "LATENCY_SPIKE",
      baseline: 85.4,
      current: 2340.7,
      aiExplanation:
        "1. LIKELY ROOT CAUSE\nThe latency spike on /api/payments is likely caused by a slow database query or external payment gateway timeout.\n\n2. DATABASE OPTIMIZATION SUGGESTION\nAdd an index on the payments table for frequently queried columns. Review slow query logs for N+1 query patterns.\n\n3. CODE-LEVEL SUGGESTION\nImplement connection pooling and add a circuit breaker pattern for external payment gateway calls.\n\n4. INFRASTRUCTURE SUGGESTION\nConsider adding a caching layer (Redis) for idempotent payment lookups and scale the database read replicas.\n\n5. SCALING RECOMMENDATION\nImplement horizontal scaling for the payments service and use a message queue for async payment processing.",
    },
  });

  await prisma.anomaly.create({
    data: {
      endpoint: "/api/search",
      type: "ERROR_SPIKE",
      baseline: 5,
      current: 28.5,
      aiExplanation:
        "1. LIKELY ROOT CAUSE\nHigh error rate on /api/search suggests the search index is unavailable or returning malformed results.\n\n2. DATABASE OPTIMIZATION SUGGESTION\nVerify Elasticsearch/search index health and replication status. Check for query timeout settings.\n\n3. CODE-LEVEL SUGGESTION\nAdd proper error handling and fallback to basic SQL search when the search index is unavailable.\n\n4. INFRASTRUCTURE SUGGESTION\nSet up search index monitoring and alerting. Consider deploying search index replicas across availability zones.\n\n5. SCALING RECOMMENDATION\nImplement search result caching for popular queries and use CDN for static search assets.",
    },
  });

  console.log("Created sample anomalies with AI explanations.");
  console.log("\nSeed complete! You can login with:");
  console.log("  Email: demo@example.com");
  console.log("  Password: password123");
};

seed()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
