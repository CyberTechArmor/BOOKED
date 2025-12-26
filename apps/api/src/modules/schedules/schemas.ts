import { z } from 'zod';

export const scheduleWindowSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:mm format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:mm format'),
  specificDate: z.string().datetime().optional().nullable(),
  isAvailable: z.boolean().default(true),
});

export const createScheduleSchema = z.object({
  name: z.string().min(1).max(255),
  isDefault: z.boolean().default(false),
  bufferBefore: z.number().min(0).max(120).optional().nullable(),
  bufferAfter: z.number().min(0).max(120).optional().nullable(),
  minimumNotice: z.number().min(0).max(720).optional().nullable(), // hours
  maxBookingsPerDay: z.number().min(1).max(100).optional().nullable(),
  maxBookingsPerWeek: z.number().min(1).max(500).optional().nullable(),
  windows: z.array(scheduleWindowSchema).optional(),
});

export const updateScheduleSchema = createScheduleSchema.partial();

export const addWindowSchema = scheduleWindowSchema;

export type ScheduleWindowInput = z.infer<typeof scheduleWindowSchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
