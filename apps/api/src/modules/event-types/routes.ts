import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  createEventTypeSchema,
  updateEventTypeSchema,
  addHostSchema,
  type CreateEventTypeInput,
  type UpdateEventTypeInput,
  type AddHostInput,
} from './schemas.js';
import {
  listEventTypes,
  getEventTypeById,
  createEventType,
  updateEventType,
  deleteEventType,
  addHost,
  removeHost,
  listHosts,
} from './service.js';
import { authenticate, requirePermission } from '../../common/middleware/auth.js';
import { ValidationError, UnauthorizedError, ForbiddenError } from '../../common/utils/errors.js';

function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError('Invalid input', result.error.errors);
  }
  return result.data;
}

export async function eventTypeRoutes(app: FastifyInstance): Promise<void> {
  // List event types
  app.get('/', {
    preHandler: [authenticate, requirePermission('event-types:read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.organization) {
      throw new ForbiddenError('Organization context required');
    }

    const eventTypes = await listEventTypes(request.organization.id);

    return reply.send({
      success: true,
      data: eventTypes,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Get event type by ID
  app.get<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate, requirePermission('event-types:read')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const eventType = await getEventTypeById(request.params.id);

    return reply.send({
      success: true,
      data: eventType,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Create event type
  app.post('/', {
    preHandler: [authenticate, requirePermission('event-types:write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || !request.organization) {
      throw new UnauthorizedError();
    }

    const input = validateBody(createEventTypeSchema, request.body);

    let eventType;
    try {
      eventType = await createEventType(
        input,
        request.user.id,
        request.organization.id
      );
    } catch (err) {
      // Log the actual error for debugging
      console.error('Event type creation error:', err);
      throw err;
    }

    return reply.status(201).send({
      success: true,
      data: eventType,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Update event type
  app.patch<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate, requirePermission('event-types:write')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const input = validateBody(updateEventTypeSchema, request.body);

    let eventType;
    try {
      eventType = await updateEventType(request.params.id, input);
    } catch (err) {
      // Log the actual error for debugging
      console.error('Event type update error:', err);
      throw err;
    }

    return reply.send({
      success: true,
      data: eventType,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Delete event type
  app.delete<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate, requirePermission('event-types:write')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await deleteEventType(request.params.id);

    return reply.send({
      success: true,
      data: null,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // List hosts
  app.get<{ Params: { id: string } }>('/:id/hosts', {
    preHandler: [authenticate, requirePermission('event-types:read')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const hosts = await listHosts(request.params.id);

    return reply.send({
      success: true,
      data: hosts,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Add host
  app.post<{ Params: { id: string } }>('/:id/hosts', {
    preHandler: [authenticate, requirePermission('event-types:write')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const input = validateBody(addHostSchema, request.body);
    const host = await addHost(request.params.id, input);

    return reply.status(201).send({
      success: true,
      data: host,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Remove host
  app.delete<{ Params: { id: string; userId: string } }>('/:id/hosts/:userId', {
    preHandler: [authenticate, requirePermission('event-types:write')],
  }, async (
    request: FastifyRequest<{ Params: { id: string; userId: string } }>,
    reply: FastifyReply
  ) => {
    await removeHost(request.params.id, request.params.userId);

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
