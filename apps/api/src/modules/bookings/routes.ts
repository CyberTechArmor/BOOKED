import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  createBookingSchema,
  updateBookingSchema,
  cancelBookingSchema,
  rescheduleBookingSchema,
  listBookingsQuerySchema,
  type CreateBookingInput,
  type UpdateBookingInput,
  type CancelBookingInput,
  type RescheduleBookingInput,
  type ListBookingsQuery,
} from './schemas.js';
import {
  listBookings,
  getBookingById,
  getBookingByUid,
  createBooking,
  updateBooking,
  cancelBooking,
  confirmBooking,
  rescheduleBooking,
} from './service.js';
import { authenticate, requirePermission } from '../../common/middleware/auth.js';
import { ValidationError, ForbiddenError } from '../../common/utils/errors.js';
import { RequestContext, runWithContext } from '../../common/utils/context.js';

// Helper to create context from request
function createRequestContext(request: FastifyRequest): RequestContext {
  return {
    requestId: request.id,
    organizationId: request.organization?.id,
    userId: request.user?.id,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'] ?? 'unknown',
  };
}

function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError('Invalid input', result.error.errors);
  }
  return result.data;
}

function validateQuery<T extends z.ZodTypeAny>(schema: T, query: unknown): z.infer<T> {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new ValidationError('Invalid query parameters', result.error.errors);
  }
  return result.data;
}

export async function bookingRoutes(app: FastifyInstance): Promise<void> {
  // List bookings
  app.get('/', {
    preHandler: [authenticate, requirePermission('bookings:read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = createRequestContext(request);
    const query = validateQuery(listBookingsQuerySchema, request.query);

    const result = await runWithContext(ctx, () => listBookings(query));

    return reply.send({
      success: true,
      data: result.bookings,
      pagination: result.pagination,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Get booking by ID
  app.get<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate, requirePermission('bookings:read')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const ctx = createRequestContext(request);
    const booking = await runWithContext(ctx, () => getBookingById(request.params.id));

    return reply.send({
      success: true,
      data: booking,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Get booking by UID
  app.get<{ Params: { uid: string } }>('/uid/:uid', {
    preHandler: [authenticate, requirePermission('bookings:read')],
  }, async (request: FastifyRequest<{ Params: { uid: string } }>, reply: FastifyReply) => {
    const ctx = createRequestContext(request);
    const booking = await runWithContext(ctx, () => getBookingByUid(request.params.uid));

    return reply.send({
      success: true,
      data: booking,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Create booking
  app.post('/', {
    preHandler: [authenticate, requirePermission('bookings:write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = createRequestContext(request);
    const input = validateBody(createBookingSchema, request.body);
    const booking = await runWithContext(ctx, () => createBooking(input));

    return reply.status(201).send({
      success: true,
      data: booking,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Update booking
  app.patch<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate, requirePermission('bookings:write')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const ctx = createRequestContext(request);
    const input = validateBody(updateBookingSchema, request.body);
    const booking = await runWithContext(ctx, () => updateBooking(request.params.id, input));

    return reply.send({
      success: true,
      data: booking,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Confirm booking
  app.post<{ Params: { id: string } }>('/:id/confirm', {
    preHandler: [authenticate, requirePermission('bookings:write')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const ctx = createRequestContext(request);
    const booking = await runWithContext(ctx, () => confirmBooking(request.params.id));

    return reply.send({
      success: true,
      data: booking,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Cancel booking
  app.post<{ Params: { id: string } }>('/:id/cancel', {
    preHandler: [authenticate, requirePermission('bookings:write')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const ctx = createRequestContext(request);
    const input = validateBody(cancelBookingSchema, request.body);
    const booking = await runWithContext(ctx, () => cancelBooking(request.params.id, input.reason));

    return reply.send({
      success: true,
      data: booking,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Reschedule booking
  app.post<{ Params: { id: string } }>('/:id/reschedule', {
    preHandler: [authenticate, requirePermission('bookings:write')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const ctx = createRequestContext(request);
    const input = validateBody(rescheduleBookingSchema, request.body);
    const booking = await runWithContext(ctx, () => rescheduleBooking(request.params.id, input));

    return reply.send({
      success: true,
      data: booking,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });
}
