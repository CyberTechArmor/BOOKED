import { getContextSafe } from '../utils/context.js';

const TENANT_SCOPED_MODELS = [
  'Booking',
  'EventType',
  'Resource',
  'Webhook',
  'ApiKey',
  'AuditLog',
  'NotificationTemplate',
  // Note: BookingAuditLog is NOT included here because it doesn't have
  // an organizationId field - it gets tenant scope through its Booking relation
];

// Using 'any' for Prisma middleware compatibility - the actual types are checked at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaMiddleware = (params: any, next: (params: any) => Promise<any>) => Promise<any>;

export function createTenantIsolationMiddleware(): PrismaMiddleware {
  return async (params, next) => {
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
