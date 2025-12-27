import { z } from 'zod';

export const customFieldSchema = z.object({
  name: z.string().min(1).max(100),
  label: z.string().min(1).max(255),
  type: z.enum(['text', 'textarea', 'select', 'checkbox', 'phone', 'email']),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(), // For select type
  placeholder: z.string().optional(),
});

export const createEventTypeSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(2000).optional(),
  durationMinutes: z.number().min(5).max(480).default(30),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true),
  requiresConfirmation: z.boolean().default(false),
  assignmentType: z.enum(['SINGLE', 'ROUND_ROBIN', 'COLLECTIVE']).default('SINGLE'),
  locationType: z.enum(['MEET', 'PHONE', 'IN_PERSON', 'CUSTOM']).default('MEET'),
  locationValue: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  customFields: z.array(customFieldSchema).default([]),
  bufferBefore: z.number().min(0).max(120).optional(),
  bufferAfter: z.number().min(0).max(120).optional(),
  minimumNotice: z.number().min(0).max(720).optional(), // hours
  maxBookingsPerDay: z.number().min(1).max(100).optional(),
  maxBookingsPerWeek: z.number().min(1).max(500).optional(),
  scheduleIds: z.array(z.string()).optional(),
  hostUserIds: z.array(z.string()).optional(),
});

export const updateEventTypeSchema = createEventTypeSchema.partial();

export const addHostSchema = z.object({
  userId: z.string(),
  priority: z.number().min(0).max(100).default(0),
});

export type CustomFieldInput = z.infer<typeof customFieldSchema>;
export type CreateEventTypeInput = z.infer<typeof createEventTypeSchema>;
export type UpdateEventTypeInput = z.infer<typeof updateEventTypeSchema>;
export type AddHostInput = z.infer<typeof addHostSchema>;
