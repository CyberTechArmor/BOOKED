import { AssignmentType, LocationType } from '@prisma/client';
import { getPrismaClient } from '../../infrastructure/database/client.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../../common/utils/errors.js';
import { getContext } from '../../common/utils/context.js';
import type { CreateEventTypeInput, UpdateEventTypeInput, AddHostInput } from './schemas.js';

export interface EventType {
  id: string;
  organizationId: string;
  ownerId: string | null;
  title: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  isActive: boolean;
  isPublic: boolean;
  requiresConfirmation: boolean;
  assignmentType: string;
  locationType: string;
  locationValue: string | null;
  color: string | null;
  customFields: unknown[];
  bufferBefore: number | null;
  bufferAfter: number | null;
  minimumNotice: number | null;
  maxBookingsPerDay: number | null;
  hosts: EventTypeHost[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EventTypeHost {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  priority: number;
  isActive: boolean;
  bookingCount: number;
  lastBookedAt: Date | null;
}

export async function listEventTypes(organizationId: string): Promise<EventType[]> {
  const db = getPrismaClient();

  const eventTypes = await db.eventType.findMany({
    where: {
      organizationId,
      deletedAt: null,
    },
    include: {
      hosts: {
        include: {
          eventType: false,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get user info for hosts
  const userIds = new Set<string>();
  for (const et of eventTypes) {
    for (const host of et.hosts) {
      userIds.add(host.userId);
    }
  }

  const users = await db.user.findMany({
    where: { id: { in: Array.from(userIds) } },
    select: { id: true, name: true, email: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  return eventTypes.map((et) => ({
    id: et.id,
    organizationId: et.organizationId,
    ownerId: et.ownerId,
    title: et.title,
    slug: et.slug,
    description: et.description,
    durationMinutes: et.durationMinutes,
    isActive: et.isActive,
    isPublic: et.isPublic,
    requiresConfirmation: et.requiresConfirmation,
    assignmentType: et.assignmentType,
    locationType: et.locationType,
    locationValue: et.locationValue,
    color: et.color,
    customFields: et.customFields as unknown[],
    bufferBefore: et.bufferBefore,
    bufferAfter: et.bufferAfter,
    minimumNotice: et.minimumNotice,
    maxBookingsPerDay: et.maxBookingsPerDay,
    hosts: et.hosts.map((h) => {
      const user = userMap.get(h.userId);
      return {
        id: h.id,
        userId: h.userId,
        userName: user?.name ?? 'Unknown',
        userEmail: user?.email ?? 'unknown@example.com',
        priority: h.priority,
        isActive: h.isActive,
        bookingCount: h.bookingCount,
        lastBookedAt: h.lastBookedAt,
      };
    }),
    createdAt: et.createdAt,
    updatedAt: et.updatedAt,
  }));
}

export async function getEventTypeById(
  eventTypeId: string
): Promise<EventType> {
  const db = getPrismaClient();
  const ctx = getContext();

  const eventType = await db.eventType.findUnique({
    where: { id: eventTypeId },
    include: { hosts: true },
  });

  if (!eventType || eventType.deletedAt) {
    throw new NotFoundError('Event type not found');
  }

  if (eventType.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Access denied');
  }

  // Get user info for hosts
  const userIds = eventType.hosts.map((h) => h.userId);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return {
    id: eventType.id,
    organizationId: eventType.organizationId,
    ownerId: eventType.ownerId,
    title: eventType.title,
    slug: eventType.slug,
    description: eventType.description,
    durationMinutes: eventType.durationMinutes,
    isActive: eventType.isActive,
    isPublic: eventType.isPublic,
    requiresConfirmation: eventType.requiresConfirmation,
    assignmentType: eventType.assignmentType,
    locationType: eventType.locationType,
    locationValue: eventType.locationValue,
    color: eventType.color,
    customFields: eventType.customFields as unknown[],
    bufferBefore: eventType.bufferBefore,
    bufferAfter: eventType.bufferAfter,
    minimumNotice: eventType.minimumNotice,
    maxBookingsPerDay: eventType.maxBookingsPerDay,
    hosts: eventType.hosts.map((h) => {
      const user = userMap.get(h.userId);
      return {
        id: h.id,
        userId: h.userId,
        userName: user?.name ?? 'Unknown',
        userEmail: user?.email ?? 'unknown@example.com',
        priority: h.priority,
        isActive: h.isActive,
        bookingCount: h.bookingCount,
        lastBookedAt: h.lastBookedAt,
      };
    }),
    createdAt: eventType.createdAt,
    updatedAt: eventType.updatedAt,
  };
}

export async function createEventType(
  input: CreateEventTypeInput,
  userId: string,
  organizationId: string
): Promise<EventType> {
  const db = getPrismaClient();

  // Check slug uniqueness within organization
  const existing = await db.eventType.findUnique({
    where: {
      organizationId_slug: {
        organizationId,
        slug: input.slug,
      },
    },
  });

  if (existing) {
    throw new ConflictError('An event type with this slug already exists');
  }

  const eventType = await db.eventType.create({
    data: {
      organizationId,
      ownerId: userId,
      title: input.title,
      slug: input.slug,
      description: input.description,
      durationMinutes: input.durationMinutes,
      isActive: input.isActive ?? true,
      isPublic: input.isPublic ?? true,
      requiresConfirmation: input.requiresConfirmation ?? false,
      assignmentType: (input.assignmentType ?? 'SINGLE') as AssignmentType,
      locationType: (input.locationType ?? 'MEET') as LocationType,
      locationValue: input.locationValue,
      color: input.color,
      customFields: input.customFields ?? [],
      bufferBefore: input.bufferBefore,
      bufferAfter: input.bufferAfter,
      minimumNotice: input.minimumNotice,
      maxBookingsPerDay: input.maxBookingsPerDay,
      hosts: input.hostUserIds
        ? {
            create: input.hostUserIds.map((hostUserId, index) => ({
              userId: hostUserId,
              priority: index,
            })),
          }
        : {
            create: {
              userId,
              priority: 0,
            },
          },
    },
    include: { hosts: true },
  });

  // Link schedules if provided
  if (input.scheduleIds?.length) {
    await db.eventTypeSchedule.createMany({
      data: input.scheduleIds.map((scheduleId) => ({
        eventTypeId: eventType.id,
        scheduleId,
      })),
    });
  }

  return getEventTypeById(eventType.id);
}

export async function updateEventType(
  eventTypeId: string,
  input: UpdateEventTypeInput
): Promise<EventType> {
  const db = getPrismaClient();
  const ctx = getContext();

  const existing = await db.eventType.findUnique({
    where: { id: eventTypeId },
  });

  if (!existing || existing.deletedAt) {
    throw new NotFoundError('Event type not found');
  }

  if (existing.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Access denied');
  }

  // Check slug uniqueness if changing
  if (input.slug && input.slug !== existing.slug) {
    const slugExists = await db.eventType.findUnique({
      where: {
        organizationId_slug: {
          organizationId: existing.organizationId,
          slug: input.slug,
        },
      },
    });

    if (slugExists) {
      throw new ConflictError('An event type with this slug already exists');
    }
  }

  await db.eventType.update({
    where: { id: eventTypeId },
    data: {
      title: input.title,
      slug: input.slug,
      description: input.description,
      durationMinutes: input.durationMinutes,
      isActive: input.isActive,
      isPublic: input.isPublic,
      requiresConfirmation: input.requiresConfirmation,
      assignmentType: input.assignmentType as AssignmentType | undefined,
      locationType: input.locationType as LocationType | undefined,
      locationValue: input.locationValue,
      color: input.color,
      customFields: input.customFields,
      bufferBefore: input.bufferBefore,
      bufferAfter: input.bufferAfter,
      minimumNotice: input.minimumNotice,
      maxBookingsPerDay: input.maxBookingsPerDay,
    },
  });

  return getEventTypeById(eventTypeId);
}

export async function deleteEventType(eventTypeId: string): Promise<void> {
  const db = getPrismaClient();
  const ctx = getContext();

  const existing = await db.eventType.findUnique({
    where: { id: eventTypeId },
  });

  if (!existing || existing.deletedAt) {
    throw new NotFoundError('Event type not found');
  }

  if (existing.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Access denied');
  }

  // Soft delete
  await db.eventType.update({
    where: { id: eventTypeId },
    data: { deletedAt: new Date() },
  });
}

export async function addHost(
  eventTypeId: string,
  input: AddHostInput
): Promise<EventTypeHost> {
  const db = getPrismaClient();
  const ctx = getContext();

  const eventType = await db.eventType.findUnique({
    where: { id: eventTypeId },
  });

  if (!eventType || eventType.deletedAt) {
    throw new NotFoundError('Event type not found');
  }

  if (eventType.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Access denied');
  }

  // Check if user exists and is in the organization
  const membership = await db.organizationUser.findUnique({
    where: {
      organizationId_userId: {
        organizationId: eventType.organizationId,
        userId: input.userId,
      },
    },
    include: { user: true },
  });

  if (!membership) {
    throw new NotFoundError('User not found in organization');
  }

  // Check if already a host
  const existingHost = await db.eventTypeHost.findUnique({
    where: {
      eventTypeId_userId: {
        eventTypeId,
        userId: input.userId,
      },
    },
  });

  if (existingHost) {
    throw new ConflictError('User is already a host for this event type');
  }

  const host = await db.eventTypeHost.create({
    data: {
      eventTypeId,
      userId: input.userId,
      priority: input.priority,
    },
  });

  return {
    id: host.id,
    userId: host.userId,
    userName: membership.user.name,
    userEmail: membership.user.email,
    priority: host.priority,
    isActive: host.isActive,
    bookingCount: host.bookingCount,
    lastBookedAt: host.lastBookedAt,
  };
}

export async function removeHost(
  eventTypeId: string,
  userId: string
): Promise<void> {
  const db = getPrismaClient();
  const ctx = getContext();

  const eventType = await db.eventType.findUnique({
    where: { id: eventTypeId },
  });

  if (!eventType || eventType.deletedAt) {
    throw new NotFoundError('Event type not found');
  }

  if (eventType.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Access denied');
  }

  const host = await db.eventTypeHost.findUnique({
    where: {
      eventTypeId_userId: {
        eventTypeId,
        userId,
      },
    },
  });

  if (!host) {
    throw new NotFoundError('Host not found');
  }

  await db.eventTypeHost.delete({
    where: { id: host.id },
  });
}

export async function listHosts(eventTypeId: string): Promise<EventTypeHost[]> {
  const db = getPrismaClient();
  const ctx = getContext();

  const eventType = await db.eventType.findUnique({
    where: { id: eventTypeId },
    include: { hosts: true },
  });

  if (!eventType || eventType.deletedAt) {
    throw new NotFoundError('Event type not found');
  }

  if (eventType.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Access denied');
  }

  const userIds = eventType.hosts.map((h) => h.userId);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return eventType.hosts.map((h) => {
    const user = userMap.get(h.userId);
    return {
      id: h.id,
      userId: h.userId,
      userName: user?.name ?? 'Unknown',
      userEmail: user?.email ?? 'unknown@example.com',
      priority: h.priority,
      isActive: h.isActive,
      bookingCount: h.bookingCount,
      lastBookedAt: h.lastBookedAt,
    };
  });
}
