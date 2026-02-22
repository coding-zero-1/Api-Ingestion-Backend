import type { FastifyRequest, FastifyReply } from "fastify";
import { registerSchema, loginSchema } from "./auth.schema";
import {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
} from "./auth.service";
import { env } from "../../config/env";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: env.NODE_ENV === "production",
  path: "/",
};

const setAuthCookies = (
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string
): void => {
  reply.setCookie("access_token", accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60, // 15 minutes in seconds
  });
  reply.setCookie("refresh_token", refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  });
};

const clearAuthCookies = (reply: FastifyReply): void => {
  reply.clearCookie("access_token", { path: "/" });
  reply.clearCookie("refresh_token", { path: "/" });
};

export const registerController = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
  }

  const user = await registerUser(parsed.data);
  reply.status(201).send({ message: "User registered successfully", userId: user.id });
};

export const loginController = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
  }

  const tokens = await loginUser(parsed.data);
  setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
  reply.status(200).send({ message: "Login successful" });
};

export const refreshController = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const refreshToken = (request.cookies as Record<string, string | undefined>)["refresh_token"];
  if (!refreshToken) {
    return reply.status(401).send({ error: "No refresh token provided" });
  }

  const tokens = await refreshTokens(refreshToken);
  setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
  reply.status(200).send({ message: "Tokens refreshed" });
};

export const logoutController = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const refreshToken = (request.cookies as Record<string, string | undefined>)["refresh_token"];
  if (refreshToken) {
    await logoutUser(refreshToken);
  }
  clearAuthCookies(reply);
  reply.status(200).send({ message: "Logged out successfully" });
};
