import { FastifyRequest, FastifyReply } from 'fastify';
import { getPrismaClient } from '../../infrastructure/database/client.js';
import { getRedisClient } from '../../infrastructure/cache/redis.js';
import { UnauthorizedError, ForbiddenError, RateLimitError } from '../utils/errors.js';
import { hashSha256 } from '../utils/encryption.js';
import { setContextValue } from '../utils/context.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  timezone: string;
}

export interface AuthenticatedOrganization {
  id: string;
  slug: string;
  role: string;
}

export interface ApiKeyContext {
  id: string;
  organizationId: string;
  scopes: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    organization?: AuthenticatedOrganization;
    apiKey?: ApiKeyContext;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const db = getPrismaClient();

  // Try API key auth first
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer bk_')) {
    const apiKey = authHeader.substring(7);
    const keyHash = hashSha256(apiKey);

    const key = await db.apiKey.findUnique({
      where: { keyHash },
      include: { organization: true },
    });

    if (!key || key.revokedAt || (key.expiresAt && key.expiresAt < new Date())) {
      throw new UnauthorizedError('Invalid or expired API key');
    }

    // Check rate limit
    if (key.rateLimit) {
      const redis = getRedisClient();
      const rateLimitKey = `ratelimit:apikey:${key.id}`;
      const count = await redis.incr(rateLimitKey);
      await redis.expire(rateLimitKey, 60);

      if (count > key.rateLimit) {
        throw new RateLimitError('API key rate limit exceeded');
      }
    }

    // Update usage (async, don't block)
    db.apiKey
      .update({
        where: { id: key.id },
        data: { lastUsedAt: new Date(), usageCount: { increment: 1 } },
      })
      .catch(() => {});

    request.apiKey = {
      id: key.id,
      organizationId: key.organizationId,
      scopes: key.scopes,
    };

    request.organization = {
      id: key.organization.id,
      slug: key.organization.slug,
      role: 'API_KEY',
    };

    setContextValue('apiKeyId', key.id);
    setContextValue('organizationId', key.organizationId);
    return;
  }

  // Try session auth
  const sessionToken = request.cookies?.booked_session;
  if (!sessionToken) {
    throw new UnauthorizedError('No authentication provided');
  }

  const session = await db.session.findUnique({
    where: { token: sessionToken },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    throw new UnauthorizedError('Invalid or expired session');
  }

  request.user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    timezone: session.user.timezone,
  };

  setContextValue('userId', session.user.id);

  // Get organization from header or default
  const orgSlug = request.headers['x-organization'] as string | undefined;
  if (orgSlug) {
    const membership = await db.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        organization: { slug: orgSlug },
      },
      include: { organization: true },
    });

    if (!membership) {
      throw new ForbiddenError('Not a member of this organization');
    }

    request.organization = {
      id: membership.organization.id,
      slug: membership.organization.slug,
      role: membership.role,
    };

    setContextValue('organizationId', membership.organization.id);
  }
}

export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    const sessionToken = request.cookies?.booked_session;
    if (!sessionToken) {
      return;
    }

    const db = getPrismaClient();
    const session = await db.session.findUnique({
      where: { token: sessionToken },
      include: { user: true },
    });

    if (session && session.expiresAt >= new Date()) {
      request.user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        timezone: session.user.timezone,
      };

      setContextValue('userId', session.user.id);
    }
  } catch {
    // Ignore auth errors for optional auth
  }
}

type Permission = string;

export function requirePermission(...requiredPermissions: Permission[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const { apiKey, organization } = request;

    if (!organization) {
      throw new ForbiddenError('Organization context required');
    }

    // Get effective permissions
    let permissions: Permission[];
    if (apiKey) {
      permissions = apiKey.scopes;
    } else {
      // Get role-based permissions
      permissions = getRolePermissions(organization.role);
    }

    // Check all required permissions
    for (const required of requiredPermissions) {
      if (!permissions.includes(required) && !permissions.includes('*')) {
        throw new ForbiddenError(`Missing permission: ${required}`);
      }
    }
  };
}

function getRolePermissions(role: string): Permission[] {
  const rolePermissions: Record<string, Permission[]> = {
    OWNER: ['*'],
    ADMIN: [
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
      'api-keys:read',
      'api-keys:write',
    ],
    MEMBER: [
      'bookings:read',
      'bookings:write',
      'event-types:read',
      'resources:read',
    ],
    READONLY: [
      'bookings:read',
      'event-types:read',
      'resources:read',
    ],
    API_KEY: [], // Permissions come from API key scopes
  };

  return rolePermissions[role] ?? [];
}
