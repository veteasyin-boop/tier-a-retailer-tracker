import type { FastifyRequest } from "fastify";
import type { TenantContext } from "../identity/tenant-context.js";

export class PermissionDeniedError extends Error {
  readonly statusCode = 403;
  readonly code = "PERMISSION_DENIED";

  constructor(permission: string) {
    super(`Missing required permission: ${permission}`);
    this.name = "PermissionDeniedError";
  }
}

export function requirePermission(
  context: TenantContext | null,
  permission: string
): TenantContext {
  if (!context) {
    const error = new Error("Tenant context is required") as Error & { statusCode: number };
    error.statusCode = 401;
    throw error;
  }
  if (!context.permissions.includes(permission)) {
    throw new PermissionDeniedError(permission);
  }
  return context;
}

export function permissionPreHandler(permission: string) {
  return async (request: FastifyRequest): Promise<void> => {
    requirePermission(request.tenantContext, permission);
  };
}
