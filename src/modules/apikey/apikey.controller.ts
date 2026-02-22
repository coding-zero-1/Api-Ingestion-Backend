import type { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { createApiKey, listApiKeys, revokeApiKey } from "./apikey.service";

const createKeySchema = z.object({
  name: z.string().min(1).max(64),
});

export const createApiKeyController = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const parsed = createKeySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
  }

  const userId = request.userId!;
  const { key, record } = await createApiKey(userId, parsed.data.name);

  reply.status(201).send({
    message: "API key created. Copy it now — it will not be shown again.",
    key,
    apiKey: record,
  });
};

export const listApiKeysController = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const keys = await listApiKeys(request.userId!);
  reply.send({ apiKeys: keys });
};

export const revokeApiKeyController = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  await revokeApiKey(request.userId!, request.params.id);
  reply.send({ message: "API key revoked" });
};
