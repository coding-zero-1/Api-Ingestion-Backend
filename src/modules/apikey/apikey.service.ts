import crypto from "crypto";
import { prisma } from "../../config/prisma";

const KEY_PREFIX_LENGTH = 8;
const KEY_BYTES = 32;
const MAX_KEYS_PER_USER = 10;

const hashKey = (key: string): string =>
  crypto.createHash("sha256").update(key).digest("hex");

const generateRawKey = (): string =>
  crypto.randomBytes(KEY_BYTES).toString("hex");

export type ApiKeyRecord = {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsed: Date | null;
};

export const createApiKey = async (
  userId: string,
  name: string
): Promise<{ key: string; record: ApiKeyRecord }> => {
  const count = await prisma.apiKey.count({ where: { userId } });
  if (count >= MAX_KEYS_PER_USER) {
    throw new Error(`Maximum of ${MAX_KEYS_PER_USER} API keys allowed per account`);
  }

  const rawKey = generateRawKey();
  const prefix = rawKey.substring(0, KEY_PREFIX_LENGTH);
  const keyHash = hashKey(rawKey);

  const record = await prisma.apiKey.create({
    data: { userId, name, keyHash, prefix },
    select: { id: true, name: true, prefix: true, createdAt: true, lastUsed: true },
  });

  // Return full key only once — never stored in plain text
  return { key: `apk_${rawKey}`, record };
};

export const listApiKeys = async (userId: string): Promise<ApiKeyRecord[]> => {
  return prisma.apiKey.findMany({
    where: { userId },
    select: { id: true, name: true, prefix: true, createdAt: true, lastUsed: true },
    orderBy: { createdAt: "desc" },
  });
};

export const revokeApiKey = async (userId: string, keyId: string): Promise<void> => {
  const key = await prisma.apiKey.findUnique({ where: { id: keyId } });
  if (!key || key.userId !== userId) {
    throw new Error("API key not found");
  }
  await prisma.apiKey.delete({ where: { id: keyId } });
};

export const validateApiKey = async (
  rawKeyWithPrefix: string
): Promise<{ userId: string } | null> => {
  // Expected format: apk_<64 hex chars>
  if (!rawKeyWithPrefix.startsWith("apk_")) return null;

  const rawKey = rawKeyWithPrefix.slice(4);
  const keyHash = hashKey(rawKey);

  const record = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!record) return null;

  // Update lastUsed in background — don't await to avoid latency
  void prisma.apiKey.update({
    where: { id: record.id },
    data: { lastUsed: new Date() },
  });

  return { userId: record.userId };
};
