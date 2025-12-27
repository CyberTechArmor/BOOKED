import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySensible from '@fastify/sensible';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { nanoid } from 'nanoid';

import { getConfig } from './infrastructure/config/index.js';
import { getLogger } from './infrastructure/logging/logger.js';
import { getPrismaClient } from './infrastructure/database/client.js';
import { getRedisClient } from './infrastructure/cache/redis.js';
import { createTenantIsolationMiddleware } from './common/middleware/tenantIsolation.js';
import { RequestContext, runWithContext } from './common/utils/context.js';
import { AppError } from './common/utils/errors.js';

// Import route modules
import { authRoutes } from './modules/auth/routes.js';
import { userRoutes } from './modules/users/routes.js';
import { organizationRoutes } from './modules/organizations/routes.js';
import { scheduleRoutes } from './modules/schedules/routes.js';
import { eventTypeRoutes } from './modules/event-types/routes.js';
import { availabilityRoutes } from './modules/availability/routes.js';
import { bookingRoutes } from './modules/bookings/routes.js';
import { resourceRoutes } from './modules/resources/routes.js';
import { webhookRoutes } from './modules/webhooks/routes.js';
import { apiKeyRoutes } from './modules/integrations/api-keys/routes.js';
import { publicRoutes } from './modules/public/routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const config = getConfig();
  const logger = getLogger();

  const app = Fastify({
    logger: false, // We use our own logger
    requestIdLogLabel: 'requestId',
    genReqId: () => nanoid(),
    trustProxy: true,
  });

  // Register plugins
  await app.register(fastifySensible);

  await app.register(fastifyCookie, {
    secret: config.SESSION_SECRET,
    hook: 'onRequest',
    parseOptions: {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    },
  });

  await app.register(fastifyCors, {
    origin: config.NODE_ENV === 'production' ? false : true,
    credentials: true,
  });

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'wss:', 'https:'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });

  await app.register(fastifyRateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    redis: getRedisClient(),
    keyGenerator: (request: FastifyRequest) => request.ip,
  });

  // Swagger documentation
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'BOOKED API',
        description: 'Scheduling infrastructure for teams and enterprises',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'booked_session',
          },
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
          },
        },
      },
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
  });

  // Setup Prisma middleware for tenant isolation
  const prisma = getPrismaClient();
  // @ts-expect-error - Custom middleware types are compatible at runtime
  prisma.$use(createTenantIsolationMiddleware());

  // Request context hook
  app.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    const ctx: RequestContext = {
      requestId: request.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? 'unknown',
    };

    // Store context on request for later access
    (request as unknown as { requestContext: RequestContext }).requestContext = ctx;
  });

  // Wrap all handlers in context
  app.addHook('onRequest', async (request, reply) => {
    const originalHandler = reply.send.bind(reply);
    const ctx: RequestContext = {
      requestId: request.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? 'unknown',
    };

    // This allows context to be available in handlers
    return runWithContext(ctx, () => undefined);
  });

  // Error handler
  app.setErrorHandler(
    async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
      logger.error({
        err: error,
        requestId: request.id,
        url: request.url,
        method: request.method,
      });

      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }

      // Handle Fastify validation errors
      if ('validation' in error) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: (error as { validation: unknown }).validation,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }

      // Generic error
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            config.NODE_ENV === 'production'
              ? 'An unexpected error occurred'
              : error.message,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    }
  );

  // Health check endpoint
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  app.get('/health/ready', async () => {
    // Check database
    await prisma.$queryRaw`SELECT 1`;
    // Check Redis
    await getRedisClient().ping();

    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  });

  // Register API routes
  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(userRoutes, { prefix: '/users' });
      await api.register(organizationRoutes, { prefix: '/organizations' });
      await api.register(scheduleRoutes, { prefix: '/schedules' });
      await api.register(eventTypeRoutes, { prefix: '/event-types' });
      await api.register(availabilityRoutes, { prefix: '/availability' });
      await api.register(bookingRoutes, { prefix: '/bookings' });
      await api.register(resourceRoutes, { prefix: '/resources' });
      await api.register(webhookRoutes, { prefix: '/webhooks' });
      await api.register(apiKeyRoutes, { prefix: '/api-keys' });
      await api.register(publicRoutes, { prefix: '/public' });
    },
    { prefix: '/api/v1' }
  );

  return app;
}
