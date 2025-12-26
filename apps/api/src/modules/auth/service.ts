import { hash, verify } from '@node-rs/argon2';
import { addDays, addHours } from 'date-fns';
import { getPrismaClient } from '../../infrastructure/database/client.js';
import { getRedisClient } from '../../infrastructure/cache/redis.js';
import { getNotificationQueue } from '../../infrastructure/queue/queues.js';
import {
  UnauthorizedError,
  ValidationError,
  ConflictError,
  NotFoundError,
} from '../../common/utils/errors.js';
import { generateSecureToken } from '../../common/utils/encryption.js';
import type { RegisterInput, LoginInput, ResetPasswordInput } from './schemas.js';

const ARGON2_OPTIONS = {
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
};

const SESSION_TTL_DAYS = 7;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

interface Session {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
  timezone: string;
  emailVerified: boolean;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

export async function register(
  input: RegisterInput,
  ipAddress: string,
  userAgent: string
): Promise<{ user: AuthUser; session: Session }> {
  const db = getPrismaClient();

  // Check if email already exists
  const existingUser = await db.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (existingUser) {
    throw new ConflictError('Email already registered');
  }

  // Hash password
  const passwordHash = await hash(input.password, ARGON2_OPTIONS);

  // Create user and organization in transaction
  const result = await db.$transaction(async (tx) => {
    // Create user
    const user = await tx.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
        timezone: input.timezone,
        status: 'PENDING_VERIFICATION',
      },
    });

    // Create organization if name provided
    if (input.organizationName) {
      const baseSlug = generateSlug(input.organizationName);
      let slug = baseSlug;
      let counter = 1;

      // Ensure unique slug
      while (await tx.organization.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug,
          users: {
            create: {
              userId: user.id,
              role: 'OWNER',
            },
          },
        },
      });
    }

    // Create session
    const session = await tx.session.create({
      data: {
        userId: user.id,
        token: generateSecureToken(32),
        expiresAt: addDays(new Date(), SESSION_TTL_DAYS),
        ipAddress,
        userAgent,
      },
    });

    // Create email verification token
    const verificationToken = await tx.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: generateSecureToken(32),
        expiresAt: addHours(new Date(), 24),
      },
    });

    return { user, session, verificationToken };
  });

  // Queue verification email (async)
  const notificationQueue = getNotificationQueue();
  await notificationQueue.add('email-verification', {
    type: 'EMAIL_VERIFICATION',
    bookingId: '', // Not applicable
    recipients: [{ type: 'attendee', email: result.user.email }],
    data: {
      name: result.user.name,
      token: result.verificationToken.token,
    },
  });

  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      timezone: result.user.timezone,
      emailVerified: result.user.emailVerified,
    },
    session: {
      id: result.session.id,
      token: result.session.token,
      userId: result.session.userId,
      expiresAt: result.session.expiresAt,
    },
  };
}

export async function login(
  input: LoginInput,
  ipAddress: string,
  userAgent: string
): Promise<{ user: AuthUser; session: Session }> {
  const db = getPrismaClient();
  const redis = getRedisClient();

  const email = input.email.toLowerCase();

  // Check rate limit
  const rateLimitKey = `login_attempts:${email}`;
  const attempts = await redis.incr(rateLimitKey);

  if (attempts === 1) {
    await redis.expire(rateLimitKey, LOCKOUT_MINUTES * 60);
  }

  if (attempts > MAX_LOGIN_ATTEMPTS) {
    throw new UnauthorizedError(
      `Too many login attempts. Please try again in ${LOCKOUT_MINUTES} minutes.`
    );
  }

  // Find user
  const user = await db.user.findUnique({
    where: { email },
  });

  if (!user || !user.passwordHash) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (user.status === 'SUSPENDED') {
    throw new UnauthorizedError('Account is suspended');
  }

  // Verify password
  const valid = await verify(user.passwordHash, input.password, ARGON2_OPTIONS);

  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Reset rate limit on success
  await redis.del(rateLimitKey);

  // Create session
  const session = await db.session.create({
    data: {
      userId: user.id,
      token: generateSecureToken(32),
      expiresAt: addDays(new Date(), SESSION_TTL_DAYS),
      ipAddress,
      userAgent,
    },
  });

  // Update last login
  await db.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
    },
  });

  // Enforce max sessions (delete oldest if > 10)
  const sessions = await db.session.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });

  if (sessions.length > 10) {
    const sessionsToDelete = sessions.slice(0, sessions.length - 10);
    await db.session.deleteMany({
      where: { id: { in: sessionsToDelete.map((s) => s.id) } },
    });
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      timezone: user.timezone,
      emailVerified: user.emailVerified,
    },
    session: {
      id: session.id,
      token: session.token,
      userId: session.userId,
      expiresAt: session.expiresAt,
    },
  };
}

export async function logout(sessionToken: string): Promise<void> {
  const db = getPrismaClient();

  await db.session.delete({
    where: { token: sessionToken },
  }).catch(() => {
    // Ignore if session doesn't exist
  });
}

export async function refreshSession(
  sessionToken: string,
  ipAddress: string,
  userAgent: string
): Promise<Session> {
  const db = getPrismaClient();

  const session = await db.session.findUnique({
    where: { token: sessionToken },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    throw new UnauthorizedError('Invalid or expired session');
  }

  // Delete old session and create new one
  const [, newSession] = await db.$transaction([
    db.session.delete({ where: { id: session.id } }),
    db.session.create({
      data: {
        userId: session.userId,
        token: generateSecureToken(32),
        expiresAt: addDays(new Date(), SESSION_TTL_DAYS),
        ipAddress,
        userAgent,
      },
    }),
  ]);

  return {
    id: newSession.id,
    token: newSession.token,
    userId: newSession.userId,
    expiresAt: newSession.expiresAt,
  };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const db = getPrismaClient();

  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  // Always return success to prevent email enumeration
  if (!user) {
    return;
  }

  // Delete any existing tokens
  await db.passwordResetToken.deleteMany({
    where: { userId: user.id },
  });

  // Create new token
  const token = await db.passwordResetToken.create({
    data: {
      userId: user.id,
      token: generateSecureToken(32),
      expiresAt: addHours(new Date(), 1),
    },
  });

  // Queue reset email
  const notificationQueue = getNotificationQueue();
  await notificationQueue.add('password-reset', {
    type: 'PASSWORD_RESET',
    bookingId: '',
    recipients: [{ type: 'attendee', email: user.email }],
    data: {
      name: user.name,
      token: token.token,
    },
  });
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const db = getPrismaClient();

  const resetToken = await db.passwordResetToken.findUnique({
    where: { token: input.token },
  });

  if (!resetToken || resetToken.expiresAt < new Date() || resetToken.usedAt) {
    throw new ValidationError('Invalid or expired reset token');
  }

  // Hash new password
  const passwordHash = await hash(input.password, ARGON2_OPTIONS);

  // Update password and mark token as used
  await db.$transaction([
    db.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    db.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate all sessions
    db.session.deleteMany({
      where: { userId: resetToken.userId },
    }),
  ]);
}

export async function verifyEmail(token: string): Promise<void> {
  const db = getPrismaClient();

  const verificationToken = await db.emailVerificationToken.findUnique({
    where: { token },
  });

  if (!verificationToken || verificationToken.expiresAt < new Date() || verificationToken.usedAt) {
    throw new ValidationError('Invalid or expired verification token');
  }

  await db.$transaction([
    db.user.update({
      where: { id: verificationToken.userId },
      data: {
        emailVerified: true,
        status: 'ACTIVE',
      },
    }),
    db.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    }),
  ]);
}

export async function getAuthProviders(): Promise<string[]> {
  // Return list of configured auth providers
  const providers: string[] = ['basic'];

  // Check for configured OAuth providers
  const config = await import('../../infrastructure/config/index.js').then((m) =>
    m.getConfig()
  );

  if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) {
    providers.push('google');
  }

  if (config.MICROSOFT_CLIENT_ID && config.MICROSOFT_CLIENT_SECRET) {
    providers.push('microsoft');
  }

  return providers;
}
