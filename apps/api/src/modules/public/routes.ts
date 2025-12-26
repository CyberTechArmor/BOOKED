import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getPrismaClient } from '../../infrastructure/database/client.js';
import { getAvailability } from '../../core/availability/engine.js';
import { createBooking, CreateBookingData, cancelBooking } from '../../core/booking/engine.js';
import { ValidationError, NotFoundError } from '../../common/utils/errors.js';
import { runWithContext, RequestContext } from '../../common/utils/context.js';

const getAvailabilityQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  timezone: z.string().default('UTC'),
});

const publicBookingSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  timezone: z.string(),
  attendee: z.object({
    email: z.string().email().max(255),
    name: z.string().min(1).max(255),
    phone: z.string().max(50).optional(),
  }),
  customFieldResponses: z.record(z.unknown()).optional(),
});

const cancelBookingSchema = z.object({
  email: z.string().email(),
  reason: z.string().max(500).optional(),
});

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

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  // Rate limit for public endpoints
  const publicRateLimit = {
    max: 20,
    timeWindow: '1 minute',
  };

  // Get event type info (public)
  app.get<{ Params: { orgSlug: string; eventSlug: string } }>(
    '/:orgSlug/:eventSlug',
    { config: { rateLimit: publicRateLimit } },
    async (request: FastifyRequest<{ Params: { orgSlug: string; eventSlug: string } }>, reply: FastifyReply) => {
      const db = getPrismaClient();
      const { orgSlug, eventSlug } = request.params;

      const organization = await db.organization.findUnique({
        where: { slug: orgSlug },
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          primaryColor: true,
        },
      });

      if (!organization) {
        throw new NotFoundError('Organization not found');
      }

      const eventType = await db.eventType.findFirst({
        where: {
          organizationId: organization.id,
          slug: eventSlug,
          isActive: true,
          isPublic: true,
          deletedAt: null,
        },
        include: {
          owner: {
            select: { id: true, name: true, avatarUrl: true },
          },
          hosts: {
            where: { isActive: true },
            include: {
              eventType: false,
            },
          },
        },
      });

      if (!eventType) {
        throw new NotFoundError('Event type not found');
      }

      // Get host user info
      const hostUserIds = eventType.hosts.map((h) => h.userId);
      if (eventType.ownerId && !hostUserIds.includes(eventType.ownerId)) {
        hostUserIds.push(eventType.ownerId);
      }

      const hosts = await db.user.findMany({
        where: { id: { in: hostUserIds } },
        select: { id: true, name: true, avatarUrl: true },
      });

      return reply.send({
        success: true,
        data: {
          organization: {
            name: organization.name,
            slug: organization.slug,
            logoUrl: organization.logoUrl,
            primaryColor: organization.primaryColor,
          },
          eventType: {
            id: eventType.id,
            title: eventType.title,
            slug: eventType.slug,
            description: eventType.description,
            durationMinutes: eventType.durationMinutes,
            locationType: eventType.locationType,
            customFields: eventType.customFields,
            hosts: hosts.map((h) => ({
              id: h.id,
              name: h.name,
              avatarUrl: h.avatarUrl,
            })),
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    }
  );

  // Get availability (public)
  app.get<{ Params: { orgSlug: string; eventSlug: string } }>(
    '/:orgSlug/:eventSlug/availability',
    { config: { rateLimit: publicRateLimit } },
    async (request: FastifyRequest<{ Params: { orgSlug: string; eventSlug: string } }>, reply: FastifyReply) => {
      const db = getPrismaClient();
      const { orgSlug, eventSlug } = request.params;
      const query = validateQuery(getAvailabilityQuerySchema, request.query);

      const organization = await db.organization.findUnique({
        where: { slug: orgSlug },
      });

      if (!organization) {
        throw new NotFoundError('Organization not found');
      }

      const eventType = await db.eventType.findFirst({
        where: {
          organizationId: organization.id,
          slug: eventSlug,
          isActive: true,
          isPublic: true,
          deletedAt: null,
        },
        include: {
          hosts: { where: { isActive: true } },
        },
      });

      if (!eventType) {
        throw new NotFoundError('Event type not found');
      }

      let userIds: string[] = eventType.hosts.map((h) => h.userId);
      if (userIds.length === 0 && eventType.ownerId) {
        userIds = [eventType.ownerId];
      }

      if (userIds.length === 0) {
        return reply.send({
          success: true,
          data: {
            slots: [],
            timezone: query.timezone,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }

      const slots = await getAvailability({
        eventTypeId: eventType.id,
        userIds,
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
        durationMinutes: eventType.durationMinutes,
        timezone: query.timezone,
      });

      return reply.send({
        success: true,
        data: {
          slots: slots.map((slot) => ({
            start: slot.start.toISOString(),
            end: slot.end.toISOString(),
          })),
          timezone: query.timezone,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    }
  );

  // Create booking (public)
  app.post<{ Params: { orgSlug: string; eventSlug: string } }>(
    '/:orgSlug/:eventSlug/book',
    { config: { rateLimit: publicRateLimit } },
    async (request: FastifyRequest<{ Params: { orgSlug: string; eventSlug: string } }>, reply: FastifyReply) => {
      const db = getPrismaClient();
      const { orgSlug, eventSlug } = request.params;
      const input = validateBody(publicBookingSchema, request.body);

      const organization = await db.organization.findUnique({
        where: { slug: orgSlug },
      });

      if (!organization) {
        throw new NotFoundError('Organization not found');
      }

      const eventType = await db.eventType.findFirst({
        where: {
          organizationId: organization.id,
          slug: eventSlug,
          isActive: true,
          isPublic: true,
          deletedAt: null,
        },
        include: {
          hosts: { where: { isActive: true } },
        },
      });

      if (!eventType) {
        throw new NotFoundError('Event type not found');
      }

      // Determine host
      let hostId: string;
      if (eventType.hosts.length > 0) {
        // For round-robin, pick the first available host
        // The availability engine already handles this, but for simplicity pick first
        hostId = eventType.hosts[0]!.userId;
      } else if (eventType.ownerId) {
        hostId = eventType.ownerId;
      } else {
        throw new ValidationError('No hosts available for this event type');
      }

      const bookingData: CreateBookingData = {
        organizationId: organization.id,
        eventTypeId: eventType.id,
        hostId,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        timezone: input.timezone,
        attendee: {
          email: input.attendee.email,
          name: input.attendee.name,
          phone: input.attendee.phone,
        },
        customFieldResponses: input.customFieldResponses,
        source: 'WEB',
      };

      // Create context for the booking
      const ctx: RequestContext = {
        requestId: request.id,
        organizationId: organization.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? 'unknown',
      };

      const booking = await runWithContext(ctx, () => createBooking(bookingData));

      return reply.status(201).send({
        success: true,
        data: {
          id: booking.id,
          uid: booking.uid,
          status: booking.status,
          startTime: booking.startTime.toISOString(),
          endTime: booking.endTime.toISOString(),
          timezone: booking.timezone,
          meetingUrl: booking.meetingUrl,
          host: booking.host,
          eventType: booking.eventType,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    }
  );

  // Get booking by UID (public)
  app.get<{ Params: { uid: string } }>(
    '/booking/:uid',
    { config: { rateLimit: publicRateLimit } },
    async (request: FastifyRequest<{ Params: { uid: string } }>, reply: FastifyReply) => {
      const db = getPrismaClient();

      const booking = await db.booking.findUnique({
        where: { uid: request.params.uid },
        include: {
          host: { select: { id: true, name: true } },
          eventType: { select: { id: true, title: true, slug: true } },
          organization: { select: { name: true, slug: true } },
        },
      });

      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      return reply.send({
        success: true,
        data: {
          id: booking.id,
          uid: booking.uid,
          status: booking.status,
          startTime: booking.startTime.toISOString(),
          endTime: booking.endTime.toISOString(),
          timezone: booking.timezone,
          meetingUrl: booking.meetingUrl,
          host: booking.host,
          eventType: booking.eventType,
          organization: booking.organization,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    }
  );

  // Cancel booking (public - requires email verification)
  app.post<{ Params: { uid: string } }>(
    '/booking/:uid/cancel',
    { config: { rateLimit: publicRateLimit } },
    async (request: FastifyRequest<{ Params: { uid: string } }>, reply: FastifyReply) => {
      const db = getPrismaClient();
      const input = validateBody(cancelBookingSchema, request.body);

      const booking = await db.booking.findUnique({
        where: { uid: request.params.uid },
        include: {
          attendees: true,
          organization: true,
        },
      });

      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      // Verify the email matches an attendee
      const attendeeMatch = booking.attendees.some(
        (a) => a.email.toLowerCase() === input.email.toLowerCase()
      );

      if (!attendeeMatch) {
        throw new ValidationError('Email does not match booking attendee');
      }

      // Create context for the cancellation
      const ctx: RequestContext = {
        requestId: request.id,
        organizationId: booking.organizationId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? 'unknown',
      };

      const result = await runWithContext(ctx, () =>
        cancelBooking(booking.id, input.reason, 'ATTENDEE')
      );

      return reply.send({
        success: true,
        data: {
          id: result.id,
          uid: result.uid,
          status: result.status,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    }
  );
}
