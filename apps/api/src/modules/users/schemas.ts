import { z } from 'zod';

export const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  timezone: z.string().optional(),
  locale: z.string().max(10).optional(),
});

export const getUserAvailabilityQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  timezone: z.string().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type GetUserAvailabilityQuery = z.infer<typeof getUserAvailabilityQuerySchema>;
