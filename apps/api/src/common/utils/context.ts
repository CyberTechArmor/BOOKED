import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
  userId?: string;
  organizationId?: string;
  apiKeyId?: string;
  ipAddress: string;
  userAgent: string;
}

const contextStorage = new AsyncLocalStorage<RequestContext>();

export function getContext(): RequestContext {
  const ctx = contextStorage.getStore();
  if (!ctx) {
    throw new Error('Request context not initialized');
  }
  return ctx;
}

export function getContextSafe(): RequestContext | undefined {
  return contextStorage.getStore();
}

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return contextStorage.run(ctx, fn);
}

export function setContextValue<K extends keyof RequestContext>(
  key: K,
  value: RequestContext[K]
): void {
  const ctx = contextStorage.getStore();
  if (ctx) {
    ctx[key] = value;
  }
}
