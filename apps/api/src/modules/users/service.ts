import { getPrismaClient } from '../../infrastructure/database/client.js';
import { NotFoundError } from '../../common/utils/errors.js';
import type { UpdateUserInput } from './schemas.js';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  timezone: string;
  locale: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: Date;
}

export interface UserOrganization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export async function getCurrentUser(userId: string): Promise<UserProfile> {
  const db = getPrismaClient();

  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    timezone: user.timezone,
    locale: user.locale,
    emailVerified: user.emailVerified,
    mfaEnabled: user.mfaEnabled,
    createdAt: user.createdAt,
  };
}

export async function updateCurrentUser(
  userId: string,
  input: UpdateUserInput
): Promise<UserProfile> {
  const db = getPrismaClient();

  const user = await db.user.update({
    where: { id: userId },
    data: input,
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    timezone: user.timezone,
    locale: user.locale,
    emailVerified: user.emailVerified,
    mfaEnabled: user.mfaEnabled,
    createdAt: user.createdAt,
  };
}

export async function getUserOrganizations(userId: string): Promise<UserOrganization[]> {
  const db = getPrismaClient();

  const memberships = await db.organizationUser.findMany({
    where: { userId },
    include: { organization: true },
  });

  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
  }));
}

export async function getUserById(
  userId: string,
  requestingUserId: string,
  organizationId: string
): Promise<UserProfile> {
  const db = getPrismaClient();

  // Check if both users are in the same organization
  const [targetMembership, requesterMembership] = await Promise.all([
    db.organizationUser.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
      include: { user: true },
    }),
    db.organizationUser.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: requestingUserId },
      },
    }),
  ]);

  if (!targetMembership || !requesterMembership) {
    throw new NotFoundError('User not found');
  }

  const user = targetMembership.user;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    timezone: user.timezone,
    locale: user.locale,
    emailVerified: user.emailVerified,
    mfaEnabled: user.mfaEnabled,
    createdAt: user.createdAt,
  };
}
