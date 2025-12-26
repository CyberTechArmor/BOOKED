import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getPrismaClient } from '../../infrastructure/database/client.js';
import { authenticate, requirePermission } from '../../common/middleware/auth.js';
import { ValidationError, ForbiddenError, NotFoundError } from '../../common/utils/errors.js';
import { getContext } from '../../common/utils/context.js';
import { generateSecureToken } from '../../common/utils/encryption.js';

const WEBHOOK_EVENTS = [
  'booking.created',
  'booking.confirmed',
  'booking.cancelled',
  'booking.rescheduled',
  'booking.completed',
  'booking.no_show',
  'event_type.created',
  'event_type.updated',
  'event_type.deleted',
  'user.created',
  'user.updated',
  'schedule.updated',
] as const;

const createWebhookSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url().max(2000),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  isActive: z.boolean().default(true),
});

const updateWebhookSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().url().max(2000).optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
  isActive: z.boolean().optional(),
});

type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError('Invalid input', result.error.errors);
  }
  return result.data;
}

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // List webhooks
  app.get('/', {
    preHandler: [authenticate, requirePermission('webhooks:read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getPrismaClient();
    const ctx = getContext();

    if (!ctx.organizationId) {
      throw new ForbiddenError('Organization context required');
    }

    const webhooks = await db.webhook.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    // Don't expose the secret
    const sanitized = webhooks.map((w) => ({
      id: w.id,
      name: w.name,
      url: w.url,
      events: w.events,
      isActive: w.isActive,
      lastTriggeredAt: w.lastTriggeredAt,
      failureCount: w.failureCount,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
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

  // Get webhook by ID
  app.get<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate, requirePermission('webhooks:read')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const db = getPrismaClient();
    const ctx = getContext();

    const webhook = await db.webhook.findUnique({
      where: { id: request.params.id },
    });

    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    if (webhook.organizationId !== ctx.organizationId) {
      throw new ForbiddenError('Access denied');
    }

    return reply.send({
      success: true,
      data: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.isActive,
        lastTriggeredAt: webhook.lastTriggeredAt,
        failureCount: webhook.failureCount,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Create webhook
  app.post('/', {
    preHandler: [authenticate, requirePermission('webhooks:write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getPrismaClient();
    const ctx = getContext();

    if (!ctx.organizationId) {
      throw new ForbiddenError('Organization context required');
    }

    const input = validateBody(createWebhookSchema, request.body);
    const secret = generateSecureToken(32);

    const webhook = await db.webhook.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name,
        url: input.url,
        secret,
        events: input.events,
        isActive: input.isActive,
      },
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        secret, // Only show secret on creation
        events: webhook.events,
        isActive: webhook.isActive,
        createdAt: webhook.createdAt,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Update webhook
  app.patch<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate, requirePermission('webhooks:write')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const db = getPrismaClient();
    const ctx = getContext();

    const existing = await db.webhook.findUnique({
      where: { id: request.params.id },
    });

    if (!existing) {
      throw new NotFoundError('Webhook not found');
    }

    if (existing.organizationId !== ctx.organizationId) {
      throw new ForbiddenError('Access denied');
    }

    const input = validateBody(updateWebhookSchema, request.body);

    const webhook = await db.webhook.update({
      where: { id: request.params.id },
      data: {
        name: input.name,
        url: input.url,
        events: input.events,
        isActive: input.isActive,
        // Reset failure count if re-enabling
        ...(input.isActive && { failureCount: 0 }),
      },
    });

    return reply.send({
      success: true,
      data: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.isActive,
        failureCount: webhook.failureCount,
        updatedAt: webhook.updatedAt,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Delete webhook
  app.delete<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate, requirePermission('webhooks:write')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const db = getPrismaClient();
    const ctx = getContext();

    const existing = await db.webhook.findUnique({
      where: { id: request.params.id },
    });

    if (!existing) {
      throw new NotFoundError('Webhook not found');
    }

    if (existing.organizationId !== ctx.organizationId) {
      throw new ForbiddenError('Access denied');
    }

    await db.webhook.delete({
      where: { id: request.params.id },
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

  // Get webhook deliveries
  app.get<{ Params: { id: string } }>('/:id/deliveries', {
    preHandler: [authenticate, requirePermission('webhooks:read')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const db = getPrismaClient();
    const ctx = getContext();

    const webhook = await db.webhook.findUnique({
      where: { id: request.params.id },
    });

    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    if (webhook.organizationId !== ctx.organizationId) {
      throw new ForbiddenError('Access denied');
    }

    const deliveries = await db.webhookDelivery.findMany({
      where: { webhookId: request.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return reply.send({
      success: true,
      data: deliveries,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Test webhook
  app.post<{ Params: { id: string } }>('/:id/test', {
    preHandler: [authenticate, requirePermission('webhooks:write')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const db = getPrismaClient();
    const ctx = getContext();

    const webhook = await db.webhook.findUnique({
      where: { id: request.params.id },
    });

    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    if (webhook.organizationId !== ctx.organizationId) {
      throw new ForbiddenError('Access denied');
    }

    // Send a test payload
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery',
      },
    };

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Booked-Event': 'test',
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000),
      });

      return reply.send({
        success: true,
        data: {
          statusCode: response.status,
          success: response.ok,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    } catch (error) {
      return reply.send({
        success: true,
        data: {
          statusCode: null,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    }
  });
}
