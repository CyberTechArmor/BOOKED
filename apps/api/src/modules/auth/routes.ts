import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type RegisterInput,
  type LoginInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from './schemas.js';
import {
  register,
  login,
  logout,
  refreshSession,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  getAuthProviders,
} from './service.js';
import { ValidationError } from '../../common/utils/errors.js';
import { getConfig } from '../../infrastructure/config/index.js';

function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError('Invalid input', result.error.errors);
  }
  return result.data;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const config = getConfig();
  const cookieOptions = {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  };

  // Register
  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = validateBody(registerSchema, request.body);
    const { user, session } = await register(
      input,
      request.ip,
      request.headers['user-agent'] ?? 'unknown'
    );

    reply.setCookie('booked_session', session.token, cookieOptions);

    return reply.status(201).send({
      success: true,
      data: {
        user,
        expiresAt: session.expiresAt,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Login
  app.post('/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const input = validateBody(loginSchema, request.body);
    const { user, session } = await login(
      input,
      request.ip,
      request.headers['user-agent'] ?? 'unknown'
    );

    reply.setCookie('booked_session', session.token, cookieOptions);

    return reply.send({
      success: true,
      data: {
        user,
        expiresAt: session.expiresAt,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Logout
  app.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionToken = request.cookies?.booked_session;
    if (sessionToken) {
      await logout(sessionToken);
    }

    reply.clearCookie('booked_session', { path: '/' });

    return reply.send({
      success: true,
      data: null,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Refresh session
  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionToken = request.cookies?.booked_session;
    if (!sessionToken) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No session found',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    }

    const session = await refreshSession(
      sessionToken,
      request.ip,
      request.headers['user-agent'] ?? 'unknown'
    );

    reply.setCookie('booked_session', session.token, cookieOptions);

    return reply.send({
      success: true,
      data: {
        expiresAt: session.expiresAt,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Forgot password
  app.post('/forgot-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = validateBody(forgotPasswordSchema, request.body);
    await requestPasswordReset(input.email);

    // Always return success to prevent email enumeration
    return reply.send({
      success: true,
      data: {
        message: 'If an account exists with this email, a password reset link has been sent.',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Reset password
  app.post('/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = validateBody(resetPasswordSchema, request.body);
    await resetPassword(input);

    return reply.send({
      success: true,
      data: {
        message: 'Password has been reset successfully. Please log in with your new password.',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Verify email
  app.post('/verify-email', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = validateBody(verifyEmailSchema, request.body);
    await verifyEmail(input.token);

    return reply.send({
      success: true,
      data: {
        message: 'Email verified successfully.',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Get available auth providers
  app.get('/providers', async (request: FastifyRequest, reply: FastifyReply) => {
    const providers = await getAuthProviders();

    return reply.send({
      success: true,
      data: {
        providers,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });
}
