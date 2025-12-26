import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  updateOrganizationSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  type UpdateOrganizationInput,
  type InviteMemberInput,
  type UpdateMemberRoleInput,
} from './schemas.js';
import {
  getCurrentOrganization,
  updateOrganization,
  getOrganizationMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
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

export async function organizationRoutes(app: FastifyInstance): Promise<void> {
  // Get current organization
  app.get('/current', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.organization) {
      throw new ForbiddenError('Organization context required');
    }

    const org = await getCurrentOrganization(request.organization.id);

    return reply.send({
      success: true,
      data: org,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Update current organization
  app.patch('/current', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || !request.organization) {
      throw new UnauthorizedError();
    }

    const input = validateBody(updateOrganizationSchema, request.body);
    const org = await updateOrganization(
      request.organization.id,
      request.user.id,
      input
    );

    return reply.send({
      success: true,
      data: org,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Get organization members
  app.get('/current/members', {
    preHandler: [authenticate, requirePermission('users:read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.organization) {
      throw new ForbiddenError('Organization context required');
    }

    const members = await getOrganizationMembers(request.organization.id);

    return reply.send({
      success: true,
      data: members,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Invite member
  app.post('/current/members', {
    preHandler: [authenticate, requirePermission('users:write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || !request.organization) {
      throw new UnauthorizedError();
    }

    const input = validateBody(inviteMemberSchema, request.body);
    const member = await inviteMember(
      request.organization.id,
      request.user.id,
      input
    );

    return reply.status(201).send({
      success: true,
      data: member,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Update member role
  app.patch<{ Params: { id: string } }>('/current/members/:id', {
    preHandler: [authenticate, requirePermission('users:write')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.user || !request.organization) {
      throw new UnauthorizedError();
    }

    const input = validateBody(updateMemberRoleSchema, request.body);
    const member = await updateMemberRole(
      request.organization.id,
      request.params.id,
      request.user.id,
      input
    );

    return reply.send({
      success: true,
      data: member,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Remove member
  app.delete<{ Params: { id: string } }>('/current/members/:id', {
    preHandler: [authenticate, requirePermission('users:write')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.user || !request.organization) {
      throw new UnauthorizedError();
    }

    await removeMember(
      request.organization.id,
      request.params.id,
      request.user.id
    );

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
