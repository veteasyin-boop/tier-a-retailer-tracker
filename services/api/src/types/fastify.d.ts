import type { User } from "@supabase/supabase-js";
import type { TenantContext } from "../modules/identity/tenant-context.js";

declare module "fastify" {
  interface FastifyRequest {
    authUser: User | null;
    tenantContext: TenantContext | null;
  }
}
