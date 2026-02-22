import "dotenv/config";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import { env } from "./config/env";
import { redis } from "./config/redis";
import { prisma } from "./config/prisma";
import { authRoutes } from "./routes/auth.routes";
import { logsRoutes } from "./routes/logs.routes";
import { metricsRoutes } from "./routes/metrics.routes";
import { anomalyRoutes } from "./routes/anomaly.routes";
import { apiKeyRoutes } from "./routes/apikey.routes";

const buildServer = async () => {
  const fastify = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "warn" : "info",
    },
    trustProxy: true,
  });

  // Plugins
  await fastify.register(fastifyCookie);
  const allowedOrigins = env.FRONTEND_ORIGIN.split(",").map((o) => o.trim());
  await fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error("Not allowed by CORS"), false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Global error handler
  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error);

    if (error.validation) {
      return reply.status(400).send({ error: "Validation error", details: error.message });
    }

    const statusCode = error.statusCode ?? 500;
    const message =
      env.NODE_ENV === "production" && statusCode === 500
        ? "Internal server error"
        : error.message;

    return reply.status(statusCode).send({ error: message });
  });

  // Routes
  await fastify.register(authRoutes);
  await fastify.register(logsRoutes);
  await fastify.register(metricsRoutes);
  await fastify.register(anomalyRoutes);
  await fastify.register(apiKeyRoutes);

  // Health check
  fastify.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  return fastify;
};

const start = async () => {
  try {
    // Connect Redis
    await redis.connect();

    const server = await buildServer();
    const port = parseInt(env.PORT, 10);

    await server.listen({ port, host: "0.0.0.0" });
    console.log(`Server running on port ${port}`);
  } catch (err) {
    console.error("Failed to start server:", err);
    await prisma.$disconnect();
    await redis.quit();
    process.exit(1);
  }
};

process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down...");
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

start();
