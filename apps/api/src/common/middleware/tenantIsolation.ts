import { Prisma } from '@prisma/client';
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

export function createTenantIsolationMiddleware(): Prisma.Middleware {
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
      params.args.where = {
        ...params.args.where,
        organizationId,
      };
    }

    // Inject organizationId for writes
    if (['create', 'createMany'].includes(params.action)) {
      params.args = params.args || {};
      if (params.action === 'create') {
        params.args.data = {
          ...params.args.data,
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
      params.args.where = {
        ...params.args.where,
        organizationId,
      };
    }

    return next(params);
  };
}
