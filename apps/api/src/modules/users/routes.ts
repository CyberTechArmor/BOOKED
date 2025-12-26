import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { updateUserSchema, type UpdateUserInput } from './schemas.js';
import {
  getCurrentUser,
  updateCurrentUser,
  getUserOrganizations,
  getUserById,
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

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // Get current user profile
  app.get('/me', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }

    const user = await getCurrentUser(request.user.id);

    return reply.send({
      success: true,
      data: user,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Update current user profile
  app.patch('/me', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }

    const input = validateBody(updateUserSchema, request.body);
    const user = await updateCurrentUser(request.user.id, input);

    return reply.send({
      success: true,
      data: user,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Get user's organizations
  app.get('/me/organizations', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }

    const organizations = await getUserOrganizations(request.user.id);

    return reply.send({
      success: true,
      data: organizations,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Get user by ID (within organization context)
  app.get<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.user || !request.organization) {
      throw new UnauthorizedError();
    }

    const user = await getUserById(
      request.params.id,
      request.user.id,
      request.organization.id
    );

    return reply.send({
      success: true,
      data: user,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });
}
