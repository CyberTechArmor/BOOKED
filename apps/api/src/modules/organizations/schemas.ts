import { z } from 'zod';

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  logoUrl: z.string().url().optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  defaultTimezone: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
  hipaaEnabled: z.boolean().optional(),
  dataRetentionDays: z.number().min(30).max(3650).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  role: z.enum(['ADMIN', 'MEMBER', 'READONLY']).default('MEMBER'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER', 'READONLY']),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
