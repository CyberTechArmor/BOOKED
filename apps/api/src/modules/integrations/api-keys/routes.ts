import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getPrismaClient } from '../../../infrastructure/database/client.js';
import { authenticate, requirePermission } from '../../../common/middleware/auth.js';
import { ValidationError, ForbiddenError, NotFoundError } from '../../../common/utils/errors.js';
import { getContext } from '../../../common/utils/context.js';
import { generateApiKey } from '../../../common/utils/encryption.js';
import { addDays } from 'date-fns';

const API_SCOPES = [
  'bookings:read',
  'bookings:write',
  'event-types:read',
  'event-types:write',
  'users:read',
  'users:write',
  'resources:read',
  'resources:write',
  'webhooks:read',
  'webhooks:write',
] as const;

const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.enum(API_SCOPES)).min(1),
  rateLimit: z.number().min(1).max(10000).optional(),
  expiresInDays: z.number().min(1).max(365).optional(),
});

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  scopes: z.array(z.enum(API_SCOPES)).min(1).optional(),
  rateLimit: z.number().min(1).max(10000).optional().nullable(),
});

type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>;

function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError('Invalid input', result.error.errors);
  }
  return result.data;
}

export async function apiKeyRoutes(app: FastifyInstance): Promise<void> {
  // List API keys
  app.get('/', {
    preHandler: [authenticate, requirePermission('api-keys:read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getPrismaClient();
    const ctx = getContext();

    if (!ctx.organizationId) {
      throw new ForbiddenError('Organization context required');
    }

    const apiKeys = await db.apiKey.findMany({
      where: {
        organizationId: ctx.organizationId,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Don't expose the hash
    const sanitized = apiKeys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      scopes: k.scopes,
      rateLimit: k.rateLimit,
      expiresAt: k.expiresAt,
      lastUsedAt: k.lastUsedAt,
      usageCount: k.usageCount,
      createdAt: k.createdAt,
    }));

    return reply.send({
      success: true,
      data: sanitized,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Get API key by ID
  app.get<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate, requirePermission('api-keys:read')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const db = getPrismaClient();
    const ctx = getContext();

    const apiKey = await db.apiKey.findUnique({
      where: { id: request.params.id },
    });

    if (!apiKey || apiKey.revokedAt) {
      throw new NotFoundError('API key not found');
    }

    if (apiKey.organizationId !== ctx.organizationId) {
      throw new ForbiddenError('Access denied');
    }

    return reply.send({
      success: true,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        rateLimit: apiKey.rateLimit,
        expiresAt: apiKey.expiresAt,
        lastUsedAt: apiKey.lastUsedAt,
        usageCount: apiKey.usageCount,
        createdAt: apiKey.createdAt,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Create API key
  app.post('/', {
    preHandler: [authenticate, requirePermission('api-keys:write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getPrismaClient();
    const ctx = getContext();

    if (!ctx.organizationId) {
      throw new ForbiddenError('Organization context required');
    }

    const input = validateBody(createApiKeySchema, request.body);
    const { key, hash, prefix } = generateApiKey();

    const apiKey = await db.apiKey.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name,
        keyHash: hash,
        keyPrefix: prefix,
        scopes: input.scopes,
        rateLimit: input.rateLimit,
        expiresAt: input.expiresInDays
          ? addDays(new Date(), input.expiresInDays)
          : null,
      },
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        key, // Only shown once at creation!
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        rateLimit: apiKey.rateLimit,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
        warning: 'Store this key securely. It will not be shown again.',
      },
    });
  });

  // Update API key
  app.patch<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate, requirePermission('api-keys:write')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const db = getPrismaClient();
    const ctx = getContext();

    const existing = await db.apiKey.findUnique({
      where: { id: request.params.id },
    });

    if (!existing || existing.revokedAt) {
      throw new NotFoundError('API key not found');
    }

    if (existing.organizationId !== ctx.organizationId) {
      throw new ForbiddenError('Access denied');
    }

    const input = validateBody(updateApiKeySchema, request.body);

    const apiKey = await db.apiKey.update({
      where: { id: request.params.id },
      data: {
        name: input.name,
        scopes: input.scopes,
        rateLimit: input.rateLimit,
      },
    });

    return reply.send({
      success: true,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        rateLimit: apiKey.rateLimit,
        expiresAt: apiKey.expiresAt,
        lastUsedAt: apiKey.lastUsedAt,
        usageCount: apiKey.usageCount,
        createdAt: apiKey.createdAt,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Revoke API key
  app.delete<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate, requirePermission('api-keys:write')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const db = getPrismaClient();
    const ctx = getContext();

    const existing = await db.apiKey.findUnique({
      where: { id: request.params.id },
    });

    if (!existing || existing.revokedAt) {
      throw new NotFoundError('API key not found');
    }

    if (existing.organizationId !== ctx.organizationId) {
      throw new ForbiddenError('Access denied');
    }

    await db.apiKey.update({
      where: { id: request.params.id },
      data: { revokedAt: new Date() },
    });

    return reply.send({
      success: true,
      data: null,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });
}
