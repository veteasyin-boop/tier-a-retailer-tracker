import type { TenantContext } from "../modules/identity/tenant-context.js";

declare module "fastify" {
  interface FastifyRequest {
    tenantContext: TenantContext | null;
  }
}
