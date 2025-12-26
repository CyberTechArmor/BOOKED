import { beforeAll, afterAll, vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/booked_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '0'.repeat(64);
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters';

// Mock Redis client
vi.mock('../src/infrastructure/cache/redis', () => ({
  getRedisClient: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn(),
    eval: vi.fn(),
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn(),
  })),
  disconnectRedis: vi.fn(),
}));

// Mock BullMQ queues
vi.mock('../src/infrastructure/queue/queues', () => ({
  getNotificationQueue: vi.fn(() => ({
    add: vi.fn().mockResolvedValue({ id: 'test-job-id' }),
    remove: vi.fn(),
    close: vi.fn(),
  })),
  getWebhookQueue: vi.fn(() => ({
    add: vi.fn().mockResolvedValue({ id: 'test-job-id' }),
    close: vi.fn(),
  })),
  getCalendarSyncQueue: vi.fn(() => ({
    add: vi.fn().mockResolvedValue({ id: 'test-job-id' }),
    close: vi.fn(),
  })),
  closeQueues: vi.fn(),
}));

beforeAll(async () => {
  // Setup test database if needed
});

afterAll(async () => {
  // Cleanup
});
