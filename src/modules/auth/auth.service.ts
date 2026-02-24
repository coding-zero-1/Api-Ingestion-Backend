import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { conflict, unauthorized } from "../../config/errors";
import type { RegisterInput, LoginInput } from "./auth.schema";

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

const generateAccessToken = (userId: string): string => {
  return jwt.sign({ userId }, env.ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
};

const generateRefreshToken = (userId: string, tokenId: string): string => {
  return jwt.sign({ userId, tokenId }, env.REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
};

const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const registerUser = async (input: RegisterInput): Promise<{ id: string; email: string }> => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw conflict("Email already in use");
  }

  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashedPassword,
    },
    select: { id: true, email: true },
  });

  return user;
};

export const loginUser = async (input: LoginInput): Promise<AuthTokens> => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw unauthorized("Invalid credentials");
  }

  const valid = await bcrypt.compare(input.password, user.password);
  if (!valid) {
    throw unauthorized("Invalid credentials");
  }

  // Delete any existing refresh tokens for this user (single active token)
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  const tokenId = crypto.randomUUID();
  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id, tokenId);

  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await prisma.refreshToken.create({
    data: {
      id: tokenId,
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  return { accessToken, refreshToken };
};

export type RefreshPayload = {
  userId: string;
  tokenId: string;
};

export const refreshTokens = async (incomingRefreshToken: string): Promise<AuthTokens> => {
  let payload: RefreshPayload;

  try {
    payload = jwt.verify(incomingRefreshToken, env.REFRESH_TOKEN_SECRET) as RefreshPayload;
  } catch {
    throw unauthorized("Invalid refresh token");
  }

  const tokenHash = hashToken(incomingRefreshToken);

  const stored = await prisma.refreshToken.findUnique({
    where: { id: payload.tokenId },
  });

  if (!stored || stored.tokenHash !== tokenHash || stored.userId !== payload.userId) {
    // Possible token reuse — delete all tokens for user
    await prisma.refreshToken.deleteMany({ where: { userId: payload.userId } });
    throw unauthorized("Refresh token reuse detected");
  }

  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw unauthorized("Refresh token expired");
  }

  // Rotate: delete old token
  await prisma.refreshToken.delete({ where: { id: stored.id } });

  // Issue new tokens
  const newTokenId = crypto.randomUUID();
  const accessToken = generateAccessToken(payload.userId);
  const newRefreshToken = generateRefreshToken(payload.userId, newTokenId);

  const newTokenHash = hashToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await prisma.refreshToken.create({
    data: {
      id: newTokenId,
      userId: payload.userId,
      tokenHash: newTokenHash,
      expiresAt,
    },
  });

  return { accessToken, refreshToken: newRefreshToken };
};

export const logoutUser = async (incomingRefreshToken: string): Promise<void> => {
  try {
    const payload = jwt.verify(incomingRefreshToken, env.REFRESH_TOKEN_SECRET) as RefreshPayload;
    await prisma.refreshToken.deleteMany({ where: { userId: payload.userId } });
  } catch {
    // Even if token is invalid, clear whatever we can — no-op
  }
};

export const verifyAccessToken = (token: string): { userId: string } => {
  return jwt.verify(token, env.ACCESS_TOKEN_SECRET) as { userId: string };
};
