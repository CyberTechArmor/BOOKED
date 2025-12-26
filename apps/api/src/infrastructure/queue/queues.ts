import { Queue, Worker, Job } from 'bullmq';
import { getRedisClient } from '../cache/redis.js';
import { getLogger } from '../logging/logger.js';

const logger = getLogger();

export interface NotificationJobData {
  type: string;
  bookingId: string;
  recipients: Array<{ type: 'host' | 'attendee'; userId?: string; email?: string }>;
  data?: Record<string, unknown>;
}

export interface WebhookJobData {
  webhookId: string;
  event: string;
  data: Record<string, unknown>;
  deliveryId: string;
}

export interface CalendarSyncJobData {
  connectionId: string;
}

let notificationQueue: Queue<NotificationJobData> | undefined;
let webhookQueue: Queue<WebhookJobData> | undefined;
let calendarSyncQueue: Queue<CalendarSyncJobData> | undefined;

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

export function getNotificationQueue(): Queue<NotificationJobData> {
  if (notificationQueue) {
    return notificationQueue;
  }

  const redis = getRedisClient();
  notificationQueue = new Queue<NotificationJobData>('notifications', {
    connection: redis,
    defaultJobOptions,
  });

  return notificationQueue;
}

export function getWebhookQueue(): Queue<WebhookJobData> {
  if (webhookQueue) {
    return webhookQueue;
  }

  const redis = getRedisClient();
  webhookQueue = new Queue<WebhookJobData>('webhooks', {
    connection: redis,
    defaultJobOptions,
  });

  return webhookQueue;
}

export function getCalendarSyncQueue(): Queue<CalendarSyncJobData> {
  if (calendarSyncQueue) {
    return calendarSyncQueue;
  }

  const redis = getRedisClient();
  calendarSyncQueue = new Queue<CalendarSyncJobData>('calendar-sync', {
    connection: redis,
    defaultJobOptions,
  });

  return calendarSyncQueue;
}

export async function closeQueues(): Promise<void> {
  const queues = [notificationQueue, webhookQueue, calendarSyncQueue].filter(Boolean);
  await Promise.all(queues.map((q) => q?.close()));
  notificationQueue = undefined;
  webhookQueue = undefined;
  calendarSyncQueue = undefined;
}
