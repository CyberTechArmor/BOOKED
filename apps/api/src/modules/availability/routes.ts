import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getAvailability, getCollectiveAvailability } from '../../core/availability/engine.js';
import { getPrismaClient } from '../../infrastructure/database/client.js';
import { authenticate, optionalAuth } from '../../common/middleware/auth.js';
import { ValidationError, NotFoundError } from '../../common/utils/errors.js';

const getAvailabilityQuerySchema = z.object({
  eventTypeId: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  timezone: z.string().default('UTC'),
});

const getCollectiveAvailabilityQuerySchema = z.object({
  userIds: z.string().transform((val) => val.split(',')),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  durationMinutes: z.string().transform(Number).default('30'),
  timezone: z.string().default('UTC'),
});

function validateQuery<T extends z.ZodTypeAny>(schema: T, query: unknown): z.infer<T> {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new ValidationError('Invalid query parameters', result.error.errors);
  }
  return result.data;
}

export async function availabilityRoutes(app: FastifyInstance): Promise<void> {
  // Get available slots
  app.get('/', {
    preHandler: [optionalAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = validateQuery(getAvailabilityQuerySchema, request.query);
    const db = getPrismaClient();

    let userIds: string[] = [];
    let durationMinutes = 30;

    if (query.eventTypeId) {
      // Get hosts from event type
      const eventType = await db.eventType.findUnique({
        where: { id: query.eventTypeId },
        include: {
          hosts: { where: { isActive: true } },
          owner: true,
        },
      });

      if (!eventType) {
        throw new NotFoundError('Event type not found');
      }

      durationMinutes = eventType.durationMinutes;

      if (eventType.hosts.length > 0) {
        userIds = eventType.hosts.map((h) => h.userId);
      } else if (eventType.ownerId) {
        userIds = [eventType.ownerId];
      }
    } else if (query.userId) {
      userIds = [query.userId];
    } else {
      throw new ValidationError('Either eventTypeId or userId is required');
    }

    const slots = await getAvailability({
      eventTypeId: query.eventTypeId,
      userIds,
      startDate: new Date(query.startDate),
      endDate: new Date(query.endDate),
      durationMinutes,
      timezone: query.timezone,
    });

    return reply.send({
      success: true,
      data: {
        slots: slots.map((slot) => ({
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          hostIds: slot.hostIds,
        })),
        timezone: query.timezone,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Get collective availability
  app.get('/collective', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = validateQuery(getCollectiveAvailabilityQuerySchema, request.query);

    const slots = await getCollectiveAvailability(
      query.userIds,
      new Date(query.startDate),
      new Date(query.endDate),
      query.durationMinutes,
      query.timezone
    );

    return reply.send({
      success: true,
      data: {
        slots: slots.map((slot) => ({
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          hostIds: slot.hostIds,
        })),
        timezone: query.timezone,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });
}
