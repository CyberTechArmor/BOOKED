// Local type definitions to work around Prisma client generation issues
// These mirror the Prisma model types needed for this module

interface Booking {
  id: string;
  uid: string;
  organizationId: string;
  eventTypeId: string | null;
  hostId: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  status: string;
  title: string | null;
  description: string | null;
  location: string | null;
  meetingUrl: string | null;
  customFieldResponses: unknown;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Attendee {
  id: string;
  bookingId: string;
  email: string;
  name: string;
  phone: string | null;
  userId: string | null;
  responseStatus: string;
  isHost: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface EventType {
  id: string;
  title: string;
  slug: string;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Prisma {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type TransactionClient = any;
}

import { BookingStatus, BookingSource, AttendeeResponse } from '../../types/prisma.js';
import { getPrismaClient } from '../../infrastructure/database/client.js';
import { getRedisClient } from '../../infrastructure/cache/redis.js';
import { getNotificationQueue, getWebhookQueue } from '../../infrastructure/queue/queues.js';
import { getContext } from '../../common/utils/context.js';
import { ConflictError, NotFoundError, ValidationError } from '../../common/utils/errors.js';
import { generateSecureToken } from '../../common/utils/encryption.js';
import { nanoid } from 'nanoid';

export interface CreateBookingData {
  organizationId: string;
  eventTypeId?: string;
  hostId: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  title?: string;
  description?: string;
  attendee: {
    email: string;
    name: string;
    phone?: string;
    userId?: string;
  };
  customFieldResponses?: Record<string, unknown>;
  resourceIds?: string[];
  source?: BookingSource;
}

export interface BookingResult {
  id: string;
  uid: string;
  organizationId: string;
  eventTypeId: string | null;
  hostId: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  status: BookingStatus;
  title: string | null;
  description: string | null;
  location: string | null;
  meetingUrl: string | null;
  customFieldResponses: Record<string, unknown>;
  attendees: Array<{
    id: string;
    email: string;
    name: string;
    phone: string | null;
    responseStatus: AttendeeResponse;
    isHost: boolean;
  }>;
  host: {
    id: string;
    name: string;
    email: string;
  };
  eventType: {
    id: string;
    title: string;
    slug: string;
  } | null;
  createdAt: Date;
}

const SLOT_LOCK_TTL_MS = 30000; // 30 seconds

// Type for booking with included relations
type BookingWithRelations = Booking & {
  attendees: Attendee[];
  host: Pick<User, 'id' | 'name' | 'email'>;
  eventType: Pick<EventType, 'id' | 'title' | 'slug'> | null;
};

/**
 * Acquire a distributed lock on a time slot
 * Returns null if Redis is unavailable (booking will proceed without lock)
 */
export async function acquireSlotLock(
  hostId: string,
  startTime: Date,
  endTime: Date
): Promise<string | null> {
  try {
    const redis = getRedisClient();
    const lockKey = `slot_lock:${hostId}:${startTime.toISOString()}:${endTime.toISOString()}`;
    const lockValue = nanoid();

    const acquired = await redis.set(lockKey, lockValue, 'PX', SLOT_LOCK_TTL_MS, 'NX');

    if (!acquired) {
      throw new ConflictError('Time slot is currently being booked by another user. Please try again.');
    }

    return lockValue;
  } catch (error) {
    // If it's a conflict error, rethrow it
    if (error instanceof ConflictError) {
      throw error;
    }
    // For Redis connection errors, log and continue without lock
    // The database transaction will still prevent double-booking
    console.warn('Failed to acquire slot lock, proceeding without lock:', error);
    return null;
  }
}

/**
 * Release a slot lock
 */
export async function releaseSlotLock(
  hostId: string,
  startTime: Date,
  endTime: Date,
  lockValue: string | null
): Promise<void> {
  if (!lockValue) {
    return; // No lock was acquired
  }

  try {
    const redis = getRedisClient();
    const lockKey = `slot_lock:${hostId}:${startTime.toISOString()}:${endTime.toISOString()}`;

    // Only delete if we still own the lock
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    await redis.eval(script, 1, lockKey, lockValue);
  } catch (error) {
    // Log but don't fail - lock will expire automatically
    console.warn('Failed to release slot lock:', error);
  }
}

/**
 * Check if a time slot is available (no conflicting bookings)
 */
export async function checkSlotAvailable(
  tx: Prisma.TransactionClient,
  hostId: string,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: string
): Promise<boolean> {
  const conflicting = await tx.booking.findFirst({
    where: {
      hostId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      OR: [
        // New booking starts during existing
        { startTime: { lte: startTime }, endTime: { gt: startTime } },
        // New booking ends during existing
        { startTime: { lt: endTime }, endTime: { gte: endTime } },
        // New booking contains existing
        { startTime: { gte: startTime }, endTime: { lte: endTime } },
      ],
    },
  });

  return !conflicting;
}

/**
 * Check if a resource is available
 */
export async function checkResourceAvailable(
  tx: Prisma.TransactionClient,
  resourceId: string,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: string
): Promise<boolean> {
  const conflicting = await tx.bookingResource.findFirst({
    where: {
      resourceId,
      bookingId: excludeBookingId ? { not: excludeBookingId } : undefined,
      booking: {
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [
          { startTime: { lte: startTime }, endTime: { gt: startTime } },
          { startTime: { lt: endTime }, endTime: { gte: endTime } },
          { startTime: { gte: startTime }, endTime: { lte: endTime } },
        ],
      },
    },
  });

  return !conflicting;
}

/**
 * Generate a MEET link for the booking
 */
async function generateMeetLink(booking: CreateBookingData): Promise<string | null> {
  // For now, generate a placeholder URL
  // In production, this would integrate with MEET API
  const roomId = nanoid(10);
  return `https://meet.example.com/${roomId}`;
}

/**
 * Create a new booking
 */
export async function createBooking(data: CreateBookingData): Promise<BookingResult> {
  const db = getPrismaClient();
  const ctx = getContext();
  let lockValue: string | undefined;

  try {
    // 1. Acquire lock on the time slot
    lockValue = await acquireSlotLock(data.hostId, data.startTime, data.endTime);

    // 2. Perform booking creation in a transaction
    const result = await db.$transaction(async (tx) => {
      // Verify slot is still available
      const isAvailable = await checkSlotAvailable(
        tx,
        data.hostId,
        data.startTime,
        data.endTime
      );

      if (!isAvailable) {
        throw new ConflictError('Time slot is no longer available');
      }

      // Check resource availability
      if (data.resourceIds?.length) {
        for (const resourceId of data.resourceIds) {
          const resourceAvailable = await checkResourceAvailable(
            tx,
            resourceId,
            data.startTime,
            data.endTime
          );
          if (!resourceAvailable) {
            throw new ConflictError(`Resource is not available for this time slot`);
          }
        }
      }

      // Get event type to determine settings
      let meetingUrl: string | null = null;
      let requiresConfirmation = false;

      if (data.eventTypeId) {
        const eventType = await tx.eventType.findUnique({
          where: { id: data.eventTypeId },
        });

        if (eventType) {
          requiresConfirmation = eventType.requiresConfirmation;

          if (eventType.locationType === 'MEET') {
            meetingUrl = await generateMeetLink(data);
          }
        }
      }

      // Create the booking
      const booking = await tx.booking.create({
        data: {
          organizationId: data.organizationId,
          eventTypeId: data.eventTypeId,
          hostId: data.hostId,
          uid: nanoid(12),
          startTime: data.startTime,
          endTime: data.endTime,
          timezone: data.timezone,
          status: requiresConfirmation ? 'PENDING' : 'CONFIRMED',
          title: data.title,
          description: data.description,
          meetingUrl,
          customFieldResponses: (data.customFieldResponses ?? {}) as object,
          source: data.source ?? (ctx.apiKeyId ? 'API' : 'WEB'),
          attendees: {
            create: {
              email: data.attendee.email,
              name: data.attendee.name,
              phone: data.attendee.phone,
              userId: data.attendee.userId,
              responseStatus: 'ACCEPTED',
            },
          },
          resources: data.resourceIds?.length
            ? {
                create: data.resourceIds.map((resourceId) => ({ resourceId })),
              }
            : undefined,
        },
        include: {
          attendees: true,
          host: {
            select: { id: true, name: true, email: true },
          },
          eventType: {
            select: { id: true, title: true, slug: true },
          },
        },
      });

      // Update round-robin stats if applicable
      if (data.eventTypeId) {
        await tx.eventTypeHost.updateMany({
          where: {
            eventTypeId: data.eventTypeId,
            userId: data.hostId,
          },
          data: {
            bookingCount: { increment: 1 },
            lastBookedAt: new Date(),
          },
        });
      }

      // Create audit log
      await tx.bookingAuditLog.create({
        data: {
          bookingId: booking.id,
          action: 'created',
          actorId: ctx.userId,
          actorType: ctx.apiKeyId ? 'API_KEY' : ctx.userId ? 'USER' : 'SYSTEM',
          details: {
            source: booking.source,
            attendee: data.attendee,
          },
        },
      });

      return booking as unknown as BookingWithRelations;
    });

    // 3. Queue notifications (outside transaction) - don't fail booking if queue fails
    try {
      const notificationQueue = getNotificationQueue();
      await notificationQueue.add('booking-created', {
        type: 'BOOKING_CREATED',
        bookingId: result.id,
        recipients: [
          { type: 'host', userId: result.hostId },
          { type: 'attendee', email: data.attendee.email },
        ],
      });
    } catch (error) {
      console.warn('Failed to queue booking notification:', error);
    }

    // 4. Queue webhook dispatch - don't fail booking if queue fails
    try {
      const webhookQueue = getWebhookQueue();
      await webhookQueue.add('booking-created', {
        webhookId: '', // Will be resolved by worker
        event: 'booking.created',
        data: {
          booking: {
            id: result.id,
            uid: result.uid,
            status: result.status,
            startTime: result.startTime.toISOString(),
            endTime: result.endTime.toISOString(),
            host: result.host,
            attendees: result.attendees,
            eventType: result.eventType,
            meetingUrl: result.meetingUrl,
          },
        },
        deliveryId: nanoid(),
      });
    } catch (error) {
      console.warn('Failed to queue booking webhook:', error);
    }

    // Schedule reminders - don't fail booking if queue fails
    try {
      await scheduleReminders(result.id, result.startTime);
    } catch (error) {
      console.warn('Failed to schedule booking reminders:', error);
    }

    return {
      id: result.id,
      uid: result.uid,
      organizationId: result.organizationId,
      eventTypeId: result.eventTypeId,
      hostId: result.hostId,
      startTime: result.startTime,
      endTime: result.endTime,
      timezone: result.timezone,
      status: result.status as BookingStatus,
      title: result.title,
      description: result.description,
      location: result.location,
      meetingUrl: result.meetingUrl,
      customFieldResponses: result.customFieldResponses as Record<string, unknown>,
      attendees: result.attendees.map((a) => ({
        id: a.id,
        email: a.email,
        name: a.name,
        phone: a.phone,
        responseStatus: a.responseStatus as AttendeeResponse,
        isHost: a.isHost,
      })),
      host: result.host,
      eventType: result.eventType,
      createdAt: result.createdAt,
    };
  } finally {
    // Always release the lock
    if (lockValue) {
      await releaseSlotLock(data.hostId, data.startTime, data.endTime, lockValue);
    }
  }
}

/**
 * Cancel a booking
 */
export async function cancelBooking(
  bookingId: string,
  reason?: string,
  cancelledBy: 'HOST' | 'ATTENDEE' | 'SYSTEM' = 'HOST'
): Promise<BookingResult> {
  const db = getPrismaClient();
  const ctx = getContext();

  const result = await db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        attendees: true,
        host: { select: { id: true, name: true, email: true } },
        eventType: { select: { id: true, title: true, slug: true } },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.status === 'CANCELLED') {
      throw new ValidationError('Booking is already cancelled');
    }

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason,
        cancelledBy: cancelledBy === 'SYSTEM' ? 'SYSTEM' : ctx.userId,
      },
      include: {
        attendees: true,
        host: { select: { id: true, name: true, email: true } },
        eventType: { select: { id: true, title: true, slug: true } },
      },
    });

    // Create audit log
    await tx.bookingAuditLog.create({
      data: {
        bookingId,
        action: 'cancelled',
        actorId: ctx.userId,
        actorType: ctx.apiKeyId ? 'API_KEY' : ctx.userId ? 'USER' : 'SYSTEM',
        details: {
          reason,
          cancelledBy,
        },
      },
    });

    return updated as unknown as BookingWithRelations;
  });

  // Queue notifications - don't fail cancellation if queue fails
  try {
    const notificationQueue = getNotificationQueue();
    await notificationQueue.add('booking-cancelled', {
      type: 'BOOKING_CANCELLED',
      bookingId: result.id,
      recipients: [
        { type: 'host', userId: result.hostId },
        ...result.attendees.map((a) => ({ type: 'attendee' as const, email: a.email })),
      ],
      data: { reason, cancelledBy },
    });
  } catch (error) {
    console.warn('Failed to queue cancellation notification:', error);
  }

  // Queue webhook - don't fail cancellation if queue fails
  try {
    const webhookQueue = getWebhookQueue();
    await webhookQueue.add('booking-cancelled', {
      webhookId: '',
      event: 'booking.cancelled',
      data: {
        booking: {
          id: result.id,
          uid: result.uid,
          cancelReason: reason,
          cancelledBy,
        },
      },
      deliveryId: nanoid(),
    });
  } catch (error) {
    console.warn('Failed to queue cancellation webhook:', error);
  }

  // Cancel scheduled reminders - don't fail cancellation if queue fails
  try {
    await cancelReminders(bookingId);
  } catch (error) {
    console.warn('Failed to cancel reminders:', error);
  }

  return {
    id: result.id,
    uid: result.uid,
    organizationId: result.organizationId,
    eventTypeId: result.eventTypeId,
    hostId: result.hostId,
    startTime: result.startTime,
    endTime: result.endTime,
    timezone: result.timezone,
    status: result.status as BookingStatus,
    title: result.title,
    description: result.description,
    location: result.location,
    meetingUrl: result.meetingUrl,
    customFieldResponses: result.customFieldResponses as Record<string, unknown>,
    attendees: result.attendees.map((a) => ({
      id: a.id,
      email: a.email,
      name: a.name,
      phone: a.phone,
      responseStatus: a.responseStatus as AttendeeResponse,
      isHost: a.isHost,
    })),
    host: result.host,
    eventType: result.eventType,
    createdAt: result.createdAt,
  };
}

/**
 * Confirm a pending booking
 */
export async function confirmBooking(bookingId: string): Promise<BookingResult> {
  const db = getPrismaClient();
  const ctx = getContext();

  const result = await db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.status !== 'PENDING') {
      throw new ValidationError('Only pending bookings can be confirmed');
    }

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED' },
      include: {
        attendees: true,
        host: { select: { id: true, name: true, email: true } },
        eventType: { select: { id: true, title: true, slug: true } },
      },
    });

    // Create audit log
    await tx.bookingAuditLog.create({
      data: {
        bookingId,
        action: 'confirmed',
        actorId: ctx.userId,
        actorType: ctx.apiKeyId ? 'API_KEY' : ctx.userId ? 'USER' : 'SYSTEM',
      },
    });

    return updated as unknown as BookingWithRelations;
  });

  // Queue notification - don't fail confirmation if queue fails
  try {
    const notificationQueue = getNotificationQueue();
    await notificationQueue.add('booking-confirmed', {
      type: 'BOOKING_CONFIRMED',
      bookingId: result.id,
      recipients: [
        { type: 'host', userId: result.hostId },
        ...result.attendees.map((a) => ({ type: 'attendee' as const, email: a.email })),
      ],
    });
  } catch (error) {
    console.warn('Failed to queue confirmation notification:', error);
  }

  return {
    id: result.id,
    uid: result.uid,
    organizationId: result.organizationId,
    eventTypeId: result.eventTypeId,
    hostId: result.hostId,
    startTime: result.startTime,
    endTime: result.endTime,
    timezone: result.timezone,
    status: result.status as BookingStatus,
    title: result.title,
    description: result.description,
    location: result.location,
    meetingUrl: result.meetingUrl,
    customFieldResponses: result.customFieldResponses as Record<string, unknown>,
    attendees: result.attendees.map((a) => ({
      id: a.id,
      email: a.email,
      name: a.name,
      phone: a.phone,
      responseStatus: a.responseStatus as AttendeeResponse,
      isHost: a.isHost,
    })),
    host: result.host,
    eventType: result.eventType,
    createdAt: result.createdAt,
  };
}

/**
 * Schedule reminder notifications for a booking
 */
async function scheduleReminders(bookingId: string, startTime: Date): Promise<void> {
  const notificationQueue = getNotificationQueue();

  const reminders = [
    { delay: 24 * 60 * 60 * 1000, name: '24h' }, // 24 hours before
    { delay: 60 * 60 * 1000, name: '1h' }, // 1 hour before
    { delay: 15 * 60 * 1000, name: '15m' }, // 15 minutes before
  ];

  const now = Date.now();

  for (const reminder of reminders) {
    const sendAt = startTime.getTime() - reminder.delay;

    if (sendAt > now) {
      await notificationQueue.add(
        'reminder',
        {
          type: 'BOOKING_REMINDER',
          bookingId,
          recipients: [], // Will be resolved by worker
          data: { reminderName: reminder.name },
        },
        {
          delay: sendAt - now,
          jobId: `reminder:${bookingId}:${reminder.name}`,
        }
      );
    }
  }
}

/**
 * Cancel scheduled reminders for a booking
 */
async function cancelReminders(bookingId: string): Promise<void> {
  const notificationQueue = getNotificationQueue();
  const reminders = ['24h', '1h', '15m'];

  for (const reminder of reminders) {
    try {
      await notificationQueue.remove(`reminder:${bookingId}:${reminder}`);
    } catch {
      // Ignore if job doesn't exist
    }
  }
}
