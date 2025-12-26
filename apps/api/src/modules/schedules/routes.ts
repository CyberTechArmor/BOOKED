import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  createScheduleSchema,
  updateScheduleSchema,
  addWindowSchema,
  type CreateScheduleInput,
  type UpdateScheduleInput,
  type ScheduleWindowInput,
} from './schemas.js';
import {
  getUserSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  addScheduleWindow,
  deleteScheduleWindow,
} from './service.js';
import { authenticate } from '../../common/middleware/auth.js';
import { ValidationError, UnauthorizedError } from '../../common/utils/errors.js';

function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError('Invalid input', result.error.errors);
  }
  return result.data;
}

export async function scheduleRoutes(app: FastifyInstance): Promise<void> {
  // Get user's schedules (also available via /users/me/schedules)
  app.get('/', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }

    const schedules = await getUserSchedules(request.user.id);

    return reply.send({
      success: true,
      data: schedules,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Get schedule by ID
  app.get<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }

    const schedule = await getScheduleById(request.params.id, request.user.id);

    return reply.send({
      success: true,
      data: schedule,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Create schedule
  app.post('/', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }

    const input = validateBody(createScheduleSchema, request.body);
    const schedule = await createSchedule(request.user.id, input);

    return reply.status(201).send({
      success: true,
      data: schedule,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Update schedule
  app.patch<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }

    const input = validateBody(updateScheduleSchema, request.body);
    const schedule = await updateSchedule(request.params.id, request.user.id, input);

    return reply.send({
      success: true,
      data: schedule,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Delete schedule
  app.delete<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }

    await deleteSchedule(request.params.id, request.user.id);

    return reply.send({
      success: true,
      data: null,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Add window to schedule
  app.post<{ Params: { id: string } }>('/:id/windows', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }

    const input = validateBody(addWindowSchema, request.body);
    const window = await addScheduleWindow(request.params.id, request.user.id, input);

    return reply.status(201).send({
      success: true,
      data: window,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Delete window from schedule
  app.delete<{ Params: { id: string; windowId: string } }>('/:id/windows/:windowId', {
    preHandler: [authenticate],
  }, async (
    request: FastifyRequest<{ Params: { id: string; windowId: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }

    await deleteScheduleWindow(request.params.id, request.params.windowId, request.user.id);

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
