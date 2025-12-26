import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ResourceType } from '@prisma/client';
import { getPrismaClient } from '../../infrastructure/database/client.js';
import { authenticate, requirePermission } from '../../common/middleware/auth.js';
import { ValidationError, ForbiddenError, NotFoundError } from '../../common/utils/errors.js';
import { getContext } from '../../common/utils/context.js';

const createResourceSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['ROOM', 'EQUIPMENT', 'OTHER']),
  description: z.string().max(1000).optional(),
  capacity: z.number().min(1).max(10000).optional(),
  isActive: z.boolean().default(true),
});

const updateResourceSchema = createResourceSchema.partial();

const getResourceAvailabilityQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

type CreateResourceInput = z.infer<typeof createResourceSchema>;
type UpdateResourceInput = z.infer<typeof updateResourceSchema>;

function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError('Invalid input', result.error.errors);
  }
  return result.data;
}

function validateQuery<T>(schema: z.ZodSchema<T>, query: unknown): T {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new ValidationError('Invalid query parameters', result.error.errors);
  }
  return result.data;
}

export async function resourceRoutes(app: FastifyInstance): Promise<void> {
  // List resources
  app.get('/', {
    preHandler: [authenticate, requirePermission('resources:read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getPrismaClient();
    const ctx = getContext();

    if (!ctx.organizationId) {
      throw new ForbiddenError('Organization context required');
    }

    const resources = await db.resource.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { name: 'asc' },
    });

    return reply.send({
      success: true,
      data: resources,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Get resource by ID
  app.get<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate, requirePermission('resources:read')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const db = getPrismaClient();
    const ctx = getContext();

    const resource = await db.resource.findUnique({
      where: { id: request.params.id },
    });

    if (!resource) {
      throw new NotFoundError('Resource not found');
    }

    if (resource.organizationId !== ctx.organizationId) {
      throw new ForbiddenError('Access denied');
    }

    return reply.send({
      success: true,
      data: resource,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Create resource
  app.post('/', {
    preHandler: [authenticate, requirePermission('resources:write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getPrismaClient();
    const ctx = getContext();

    if (!ctx.organizationId) {
      throw new ForbiddenError('Organization context required');
    }

    const input = validateBody(createResourceSchema, request.body);

    const resource = await db.resource.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name,
        type: input.type as ResourceType,
        description: input.description,
        capacity: input.capacity,
        isActive: input.isActive,
      },
    });

    return reply.status(201).send({
      success: true,
      data: resource,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Update resource
  app.patch<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate, requirePermission('resources:write')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const db = getPrismaClient();
    const ctx = getContext();

    const existing = await db.resource.findUnique({
      where: { id: request.params.id },
    });

    if (!existing) {
      throw new NotFoundError('Resource not found');
    }

    if (existing.organizationId !== ctx.organizationId) {
      throw new ForbiddenError('Access denied');
    }

    const input = validateBody(updateResourceSchema, request.body);

    const resource = await db.resource.update({
      where: { id: request.params.id },
      data: {
        name: input.name,
        type: input.type as ResourceType | undefined,
        description: input.description,
        capacity: input.capacity,
        isActive: input.isActive,
      },
    });

    return reply.send({
      success: true,
      data: resource,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Delete resource
  app.delete<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate, requirePermission('resources:write')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const db = getPrismaClient();
    const ctx = getContext();

    const existing = await db.resource.findUnique({
      where: { id: request.params.id },
    });

    if (!existing) {
      throw new NotFoundError('Resource not found');
    }

    if (existing.organizationId !== ctx.organizationId) {
      throw new ForbiddenError('Access denied');
    }

    await db.resource.delete({
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

  // Get resource availability
  app.get<{ Params: { id: string } }>('/:id/availability', {
    preHandler: [authenticate, requirePermission('resources:read')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const db = getPrismaClient();
    const ctx = getContext();
    const query = validateQuery(getResourceAvailabilityQuerySchema, request.query);

    const resource = await db.resource.findUnique({
      where: { id: request.params.id },
    });

    if (!resource) {
      throw new NotFoundError('Resource not found');
    }

    if (resource.organizationId !== ctx.organizationId) {
      throw new ForbiddenError('Access denied');
    }

    // Get bookings using this resource
    const bookings = await db.bookingResource.findMany({
      where: {
        resourceId: request.params.id,
        booking: {
          status: { in: ['PENDING', 'CONFIRMED'] },
          startTime: { lt: new Date(query.endDate) },
          endTime: { gt: new Date(query.startDate) },
        },
      },
      include: {
        booking: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            title: true,
          },
        },
      },
    });

    return reply.send({
      success: true,
      data: {
        resource,
        busyTimes: bookings.map((br) => ({
          bookingId: br.booking.id,
          start: br.booking.startTime.toISOString(),
          end: br.booking.endTime.toISOString(),
          title: br.booking.title,
        })),
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });
}
