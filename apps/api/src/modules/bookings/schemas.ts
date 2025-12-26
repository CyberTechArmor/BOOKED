import { z } from 'zod';

export const attendeeSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(255),
  phone: z.string().max(50).optional(),
});

export const createBookingSchema = z.object({
  eventTypeId: z.string().optional(),
  hostId: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  timezone: z.string(),
  title: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  attendee: attendeeSchema,
  customFieldResponses: z.record(z.unknown()).optional(),
  resourceIds: z.array(z.string()).optional(),
}).refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  'End time must be after start time'
);

export const updateBookingSchema = z.object({
  title: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  location: z.string().max(500).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const rescheduleBookingSchema = z.object({
  newStartTime: z.string().datetime(),
  newEndTime: z.string().datetime(),
  reason: z.string().max(500).optional(),
}).refine(
  (data) => new Date(data.newEndTime) > new Date(data.newStartTime),
  'End time must be after start time'
);

export const listBookingsQuerySchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  hostId: z.string().optional(),
  eventTypeId: z.string().optional(),
  limit: z.string().transform(Number).default('20'),
  cursor: z.string().optional(),
});

export type AttendeeInput = z.infer<typeof attendeeSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
