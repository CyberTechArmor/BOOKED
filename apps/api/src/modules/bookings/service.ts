import { BookingStatus } from '../../types/prisma.js';
import { getPrismaClient } from '../../infrastructure/database/client.js';
import { getContext } from '../../common/utils/context.js';
import { NotFoundError, ForbiddenError } from '../../common/utils/errors.js';
import {
  createBooking as createBookingCore,
  cancelBooking as cancelBookingCore,
  confirmBooking as confirmBookingCore,
  BookingResult,
  CreateBookingData,
} from '../../core/booking/engine.js';
import type {
  CreateBookingInput,
  UpdateBookingInput,
  ListBookingsQuery,
  RescheduleBookingInput,
} from './schemas.js';

export interface BookingListResult {
  bookings: BookingResult[];
  pagination: {
    total: number;
    cursor: string | null;
    hasMore: boolean;
  };
}

export async function listBookings(query: ListBookingsQuery): Promise<BookingListResult> {
  const db = getPrismaClient();
  const ctx = getContext();

  if (!ctx.organizationId) {
    throw new ForbiddenError('Organization context required');
  }

  const where = {
    organizationId: ctx.organizationId,
    ...(query.status && { status: query.status as BookingStatus }),
    ...(query.hostId && { hostId: query.hostId }),
    ...(query.eventTypeId && { eventTypeId: query.eventTypeId }),
    ...(query.startDate && { startTime: { gte: new Date(query.startDate) } }),
    ...(query.endDate && { endTime: { lte: new Date(query.endDate) } }),
  };

  const [bookings, total] = await Promise.all([
    db.booking.findMany({
      where,
      include: {
        attendees: true,
        host: { select: { id: true, name: true, email: true } },
        eventType: { select: { id: true, title: true, slug: true } },
      },
      orderBy: { startTime: 'desc' },
      take: query.limit + 1,
      ...(query.cursor && {
        cursor: { id: query.cursor },
        skip: 1,
      }),
    }),
    db.booking.count({ where }),
  ]);

  const hasMore = bookings.length > query.limit;
  const items = hasMore ? bookings.slice(0, -1) : bookings;
  const lastItem = items[items.length - 1];

  return {
    bookings: items.map((b) => ({
      id: b.id,
      uid: b.uid,
      organizationId: b.organizationId,
      eventTypeId: b.eventTypeId,
      hostId: b.hostId,
      startTime: b.startTime,
      endTime: b.endTime,
      timezone: b.timezone,
      status: b.status,
      title: b.title,
      description: b.description,
      location: b.location,
      meetingUrl: b.meetingUrl,
      customFieldResponses: b.customFieldResponses as Record<string, unknown>,
      attendees: b.attendees.map((a) => ({
        id: a.id,
        email: a.email,
        name: a.name,
        phone: a.phone,
        responseStatus: a.responseStatus,
        isHost: a.isHost,
      })),
      host: b.host,
      eventType: b.eventType,
      createdAt: b.createdAt,
    })),
    pagination: {
      total,
      cursor: lastItem?.id ?? null,
      hasMore,
    },
  };
}

export async function getBookingById(bookingId: string): Promise<BookingResult> {
  const db = getPrismaClient();
  const ctx = getContext();

  const booking = await db.booking.findUnique({
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

  if (ctx.organizationId && booking.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Access denied');
  }

  return {
    id: booking.id,
    uid: booking.uid,
    organizationId: booking.organizationId,
    eventTypeId: booking.eventTypeId,
    hostId: booking.hostId,
    startTime: booking.startTime,
    endTime: booking.endTime,
    timezone: booking.timezone,
    status: booking.status,
    title: booking.title,
    description: booking.description,
    location: booking.location,
    meetingUrl: booking.meetingUrl,
    customFieldResponses: booking.customFieldResponses as Record<string, unknown>,
    attendees: booking.attendees.map((a) => ({
      id: a.id,
      email: a.email,
      name: a.name,
      phone: a.phone,
      responseStatus: a.responseStatus,
      isHost: a.isHost,
    })),
    host: booking.host,
    eventType: booking.eventType,
    createdAt: booking.createdAt,
  };
}

export async function getBookingByUid(uid: string): Promise<BookingResult> {
  const db = getPrismaClient();

  const booking = await db.booking.findUnique({
    where: { uid },
    include: {
      attendees: true,
      host: { select: { id: true, name: true, email: true } },
      eventType: { select: { id: true, title: true, slug: true } },
    },
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  return {
    id: booking.id,
    uid: booking.uid,
    organizationId: booking.organizationId,
    eventTypeId: booking.eventTypeId,
    hostId: booking.hostId,
    startTime: booking.startTime,
    endTime: booking.endTime,
    timezone: booking.timezone,
    status: booking.status,
    title: booking.title,
    description: booking.description,
    location: booking.location,
    meetingUrl: booking.meetingUrl,
    customFieldResponses: booking.customFieldResponses as Record<string, unknown>,
    attendees: booking.attendees.map((a) => ({
      id: a.id,
      email: a.email,
      name: a.name,
      phone: a.phone,
      responseStatus: a.responseStatus,
      isHost: a.isHost,
    })),
    host: booking.host,
    eventType: booking.eventType,
    createdAt: booking.createdAt,
  };
}

export async function createBooking(input: CreateBookingInput): Promise<BookingResult> {
  const ctx = getContext();

  if (!ctx.organizationId) {
    throw new ForbiddenError('Organization context required');
  }

  const data: CreateBookingData = {
    organizationId: ctx.organizationId,
    eventTypeId: input.eventTypeId,
    hostId: input.hostId,
    startTime: new Date(input.startTime),
    endTime: new Date(input.endTime),
    timezone: input.timezone,
    title: input.title,
    description: input.description,
    attendee: input.attendee,
    customFieldResponses: input.customFieldResponses,
    resourceIds: input.resourceIds,
  };

  return createBookingCore(data);
}

export async function updateBooking(
  bookingId: string,
  input: UpdateBookingInput
): Promise<BookingResult> {
  const db = getPrismaClient();
  const ctx = getContext();

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  if (ctx.organizationId && booking.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Access denied');
  }

  await db.booking.update({
    where: { id: bookingId },
    data: {
      title: input.title,
      description: input.description,
      location: input.location,
    },
  });

  return getBookingById(bookingId);
}

export async function cancelBooking(
  bookingId: string,
  reason?: string
): Promise<BookingResult> {
  return cancelBookingCore(bookingId, reason, 'HOST');
}

export async function confirmBooking(bookingId: string): Promise<BookingResult> {
  return confirmBookingCore(bookingId);
}

export async function rescheduleBooking(
  bookingId: string,
  input: RescheduleBookingInput
): Promise<BookingResult> {
  const db = getPrismaClient();
  const ctx = getContext();

  const original = await db.booking.findUnique({
    where: { id: bookingId },
    include: { attendees: true },
  });

  if (!original) {
    throw new NotFoundError('Booking not found');
  }

  if (ctx.organizationId && original.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Access denied');
  }

  const attendee = original.attendees[0];
  if (!attendee) {
    throw new NotFoundError('No attendee found on booking');
  }

  // Create new booking with reference to original
  const newBookingData: CreateBookingData = {
    organizationId: original.organizationId,
    eventTypeId: original.eventTypeId ?? undefined,
    hostId: original.hostId,
    startTime: new Date(input.newStartTime),
    endTime: new Date(input.newEndTime),
    timezone: original.timezone,
    title: original.title ?? undefined,
    description: original.description ?? undefined,
    attendee: {
      email: attendee.email,
      name: attendee.name,
      phone: attendee.phone ?? undefined,
      userId: attendee.userId ?? undefined,
    },
    customFieldResponses: original.customFieldResponses as Record<string, unknown>,
  };

  const newBooking = await createBookingCore(newBookingData);

  // Update new booking to reference original
  await db.booking.update({
    where: { id: newBooking.id },
    data: { rescheduledFrom: bookingId },
  });

  // Cancel original
  await cancelBookingCore(bookingId, input.reason ?? 'Rescheduled', 'SYSTEM');

  return newBooking;
}
