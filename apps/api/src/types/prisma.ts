/**
 * Prisma Type Definitions
 *
 * These types mirror the enums and types defined in the Prisma schema.
 * They are used for type-safety in the application code.
 *
 * Note: These must be kept in sync with prisma/schema.prisma
 */

// Organization Roles
export const OrgRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  READONLY: 'READONLY',
} as const;
export type OrgRole = (typeof OrgRole)[keyof typeof OrgRole];

// User Status
export const UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

// Booking Status
export const BookingStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

// Booking Source
export const BookingSource = {
  WEB: 'WEB',
  API: 'API',
  NEON: 'NEON',
  INTERNAL: 'INTERNAL',
} as const;
export type BookingSource = (typeof BookingSource)[keyof typeof BookingSource];

// Attendee Response
export const AttendeeResponse = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  TENTATIVE: 'TENTATIVE',
} as const;
export type AttendeeResponse = (typeof AttendeeResponse)[keyof typeof AttendeeResponse];

// Assignment Type
export const AssignmentType = {
  SINGLE: 'SINGLE',
  ROUND_ROBIN: 'ROUND_ROBIN',
  COLLECTIVE: 'COLLECTIVE',
} as const;
export type AssignmentType = (typeof AssignmentType)[keyof typeof AssignmentType];

// Location Type
export const LocationType = {
  MEET: 'MEET',
  PHONE: 'PHONE',
  IN_PERSON: 'IN_PERSON',
  CUSTOM: 'CUSTOM',
} as const;
export type LocationType = (typeof LocationType)[keyof typeof LocationType];

// Resource Type
export const ResourceType = {
  ROOM: 'ROOM',
  EQUIPMENT: 'EQUIPMENT',
  OTHER: 'OTHER',
} as const;
export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];

// Actor Type (for audit logs)
export const ActorType = {
  USER: 'USER',
  API_KEY: 'API_KEY',
  SYSTEM: 'SYSTEM',
  WEBHOOK: 'WEBHOOK',
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];

// Calendar Provider
export const CalendarProvider = {
  GOOGLE: 'GOOGLE',
  MICROSOFT: 'MICROSOFT',
  CALDAV: 'CALDAV',
} as const;
export type CalendarProvider = (typeof CalendarProvider)[keyof typeof CalendarProvider];

// Notification Type
export const NotificationType = {
  BOOKING_CREATED: 'BOOKING_CREATED',
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  BOOKING_RESCHEDULED: 'BOOKING_RESCHEDULED',
  BOOKING_REMINDER: 'BOOKING_REMINDER',
  BOOKING_FOLLOWUP: 'BOOKING_FOLLOWUP',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

// Notification Channel
export const NotificationChannel = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  PUSH: 'PUSH',
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];
