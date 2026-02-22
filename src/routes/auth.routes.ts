import type { FastifyInstance } from "fastify";
import { rateLimitMiddleware } from "../middleware/rateLimit.middleware";
import {
  registerController,
  loginController,
  refreshController,
  logoutController,
} from "../modules/auth/auth.controller";

export const authRoutes = async (fastify: FastifyInstance): Promise<void> => {
  fastify.post("/auth/register", registerController);

  fastify.post("/auth/login", {
    preHandler: [rateLimitMiddleware],
    handler: loginController,
  });

  fastify.post("/auth/refresh", {
    preHandler: [rateLimitMiddleware],
    handler: refreshController,
  });

  fastify.post("/auth/logout", logoutController);
};
