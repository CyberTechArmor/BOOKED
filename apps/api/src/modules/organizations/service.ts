// Prisma import removed due to client generation issues
import { OrgRole } from '../../types/prisma.js';
import { getPrismaClient } from '../../infrastructure/database/client.js';
import { getNotificationQueue } from '../../infrastructure/queue/queues.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../../common/utils/errors.js';
import { generateSecureToken } from '../../common/utils/encryption.js';
import type { UpdateOrganizationInput, InviteMemberInput, UpdateMemberRoleInput } from './schemas.js';

export interface OrganizationDetails {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  defaultTimezone: string;
  settings: Record<string, unknown>;
  hipaaEnabled: boolean;
  dataRetentionDays: number;
  createdAt: Date;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  createdAt: Date;
}

export async function getCurrentOrganization(
  organizationId: string
): Promise<OrganizationDetails> {
  const db = getPrismaClient();

  const org = await db.organization.findUnique({
    where: { id: organizationId },
  });

  if (!org) {
    throw new NotFoundError('Organization not found');
  }

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    domain: org.domain,
    logoUrl: org.logoUrl,
    primaryColor: org.primaryColor,
    defaultTimezone: org.defaultTimezone,
    settings: org.settings as Record<string, unknown>,
    hipaaEnabled: org.hipaaEnabled,
    dataRetentionDays: org.dataRetentionDays,
    createdAt: org.createdAt,
  };
}

export async function updateOrganization(
  organizationId: string,
  userId: string,
  input: UpdateOrganizationInput
): Promise<OrganizationDetails> {
  const db = getPrismaClient();

  // Check if user has permission
  const membership = await db.organizationUser.findUnique({
    where: {
      organizationId_userId: { organizationId, userId },
    },
  });

  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    throw new ForbiddenError('Insufficient permissions');
  }

  const org = await db.organization.update({
    where: { id: organizationId },
    data: {
      ...input,
      settings: input.settings as object | undefined,
    },
  });

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    domain: org.domain,
    logoUrl: org.logoUrl,
    primaryColor: org.primaryColor,
    defaultTimezone: org.defaultTimezone,
    settings: org.settings as Record<string, unknown>,
    hipaaEnabled: org.hipaaEnabled,
    dataRetentionDays: org.dataRetentionDays,
    createdAt: org.createdAt,
  };
}

export async function getOrganizationMembers(
  organizationId: string
): Promise<OrganizationMember[]> {
  const db = getPrismaClient();

  const memberships = await db.organizationUser.findMany({
    where: { organizationId },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });

  return memberships.map((m) => ({
    id: m.id,
    userId: m.user.id,
    email: m.user.email,
    name: m.user.name,
    avatarUrl: m.user.avatarUrl,
    role: m.role,
    createdAt: m.createdAt,
  }));
}

export async function inviteMember(
  organizationId: string,
  inviterId: string,
  input: InviteMemberInput
): Promise<OrganizationMember> {
  const db = getPrismaClient();

  // Check inviter permissions
  const inviterMembership = await db.organizationUser.findUnique({
    where: {
      organizationId_userId: { organizationId, userId: inviterId },
    },
  });

  if (!inviterMembership || !['OWNER', 'ADMIN'].includes(inviterMembership.role)) {
    throw new ForbiddenError('Insufficient permissions to invite members');
  }

  // Check if user already exists
  let user = await db.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  // Check if already a member
  if (user) {
    const existingMembership = await db.organizationUser.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: user.id },
      },
    });

    if (existingMembership) {
      throw new ConflictError('User is already a member of this organization');
    }
  }

  // Create user if doesn't exist
  if (!user) {
    user = await db.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        status: 'PENDING_VERIFICATION',
      },
    });
  }

  // Add to organization
  const membership = await db.organizationUser.create({
    data: {
      organizationId,
      userId: user.id,
      role: input.role as OrgRole,
    },
    include: { user: true },
  });

  // Queue invite notification
  const notificationQueue = getNotificationQueue();
  await notificationQueue.add('member-invite', {
    type: 'MEMBER_INVITE',
    bookingId: '',
    recipients: [{ type: 'attendee', email: user.email }],
    data: {
      name: user.name,
      organizationName: (await db.organization.findUnique({ where: { id: organizationId } }))?.name,
      inviteToken: generateSecureToken(32),
    },
  });

  return {
    id: membership.id,
    userId: membership.user.id,
    email: membership.user.email,
    name: membership.user.name,
    avatarUrl: membership.user.avatarUrl,
    role: membership.role,
    createdAt: membership.createdAt,
  };
}

export async function updateMemberRole(
  organizationId: string,
  membershipId: string,
  updaterId: string,
  input: UpdateMemberRoleInput
): Promise<OrganizationMember> {
  const db = getPrismaClient();

  // Check updater permissions
  const updaterMembership = await db.organizationUser.findUnique({
    where: {
      organizationId_userId: { organizationId, userId: updaterId },
    },
  });

  if (!updaterMembership || updaterMembership.role !== 'OWNER') {
    throw new ForbiddenError('Only owners can change member roles');
  }

  // Get target membership
  const targetMembership = await db.organizationUser.findUnique({
    where: { id: membershipId },
    include: { user: true },
  });

  if (!targetMembership || targetMembership.organizationId !== organizationId) {
    throw new NotFoundError('Member not found');
  }

  // Cannot change owner role
  if (targetMembership.role === 'OWNER') {
    throw new ForbiddenError('Cannot change owner role');
  }

  const updated = await db.organizationUser.update({
    where: { id: membershipId },
    data: { role: input.role as OrgRole },
    include: { user: true },
  });

  return {
    id: updated.id,
    userId: updated.user.id,
    email: updated.user.email,
    name: updated.user.name,
    avatarUrl: updated.user.avatarUrl,
    role: updated.role,
    createdAt: updated.createdAt,
  };
}

export async function removeMember(
  organizationId: string,
  membershipId: string,
  removerId: string
): Promise<void> {
  const db = getPrismaClient();

  // Check remover permissions
  const removerMembership = await db.organizationUser.findUnique({
    where: {
      organizationId_userId: { organizationId, userId: removerId },
    },
  });

  if (!removerMembership || !['OWNER', 'ADMIN'].includes(removerMembership.role)) {
    throw new ForbiddenError('Insufficient permissions to remove members');
  }

  // Get target membership
  const targetMembership = await db.organizationUser.findUnique({
    where: { id: membershipId },
  });

  if (!targetMembership || targetMembership.organizationId !== organizationId) {
    throw new NotFoundError('Member not found');
  }

  // Cannot remove owner
  if (targetMembership.role === 'OWNER') {
    throw new ForbiddenError('Cannot remove organization owner');
  }

  // Only owner can remove admins
  if (targetMembership.role === 'ADMIN' && removerMembership.role !== 'OWNER') {
    throw new ForbiddenError('Only owners can remove admins');
  }

  await db.organizationUser.delete({
    where: { id: membershipId },
  });
}
