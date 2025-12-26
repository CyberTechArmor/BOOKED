import { getContextSafe } from '../utils/context.js';

const TENANT_SCOPED_MODELS = [
  'Booking',
  'EventType',
  'Resource',
  'Webhook',
  'ApiKey',
  'AuditLog',
  'NotificationTemplate',
  'BookingAuditLog',
];

interface MiddlewareParams {
  model?: string;
  action: string;
  args: Record<string, unknown>;
  dataPath: string[];
  runInTransaction: boolean;
}

type MiddlewareNext = (params: MiddlewareParams) => Promise<unknown>;

export function createTenantIsolationMiddleware() {
  return async (params: MiddlewareParams, next: MiddlewareNext) => {
    const ctx = getContextSafe();

    // Skip if no context or no organization
    if (!ctx?.organizationId) {
      return next(params);
    }

    // Skip for non-tenant models
    if (!params.model || !TENANT_SCOPED_MODELS.includes(params.model)) {
      return next(params);
    }

    const organizationId = ctx.organizationId;

    // Inject organizationId for reads
    if (
      ['findUnique', 'findFirst', 'findMany', 'count', 'aggregate'].includes(
        params.action
      )
    ) {
      params.args = params.args || {};
      const existingWhere = (params.args.where || {}) as Record<string, unknown>;
      params.args.where = {
        ...existingWhere,
        organizationId,
      };
    }

    // Inject organizationId for writes
    if (['create', 'createMany'].includes(params.action)) {
      params.args = params.args || {};
      if (params.action === 'create') {
        const existingData = (params.args.data || {}) as Record<string, unknown>;
        params.args.data = {
          ...existingData,
          organizationId,
        };
      } else if (params.action === 'createMany' && Array.isArray(params.args.data)) {
        params.args.data = params.args.data.map((d: Record<string, unknown>) => ({
          ...d,
          organizationId,
        }));
      }
    }

    // Scope updates and deletes
    if (
      ['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)
    ) {
      params.args = params.args || {};
      const existingWhere = (params.args.where || {}) as Record<string, unknown>;
      params.args.where = {
        ...existingWhere,
        organizationId,
      };
    }

    return next(params);
  };
}
