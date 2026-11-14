import type { SupabaseClient } from "@supabase/supabase-js";
import type { FastifyPluginAsync } from "fastify";
import { TenantContextError } from "./tenant-context.js";

type TenantRouteOptions = { supabase: { admin: SupabaseClient } };

export const tenantRoutes: FastifyPluginAsync<TenantRouteOptions> = async (app, options) => {
  app.get("/tenants", async (request) => {
    if (!request.authUser) {
      throw new TenantContextError(401, "UNAUTHORIZED", "A valid authenticated user is required");
    }

    const { data, error } = await options.supabase.admin
      .from("memberships")
      .select("tenant_id,tenants!inner(id,name,slug,is_active)")
      .eq("user_id", request.authUser.id)
      .eq("status", "active")
      .eq("tenants.is_active", true)
      .limit(100);

    if (error) {
      throw new TenantContextError(500, "TENANT_DISCOVERY_FAILED", "Unable to list available tenant memberships");
    }

    type TenantRecord = { id: string; name: string; slug: string; is_active: boolean };
    type TenantMembershipRecord = { tenant_id: string; tenants: TenantRecord | TenantRecord[] | null };
    const membershipRows = (data ?? []) as TenantMembershipRecord[];
    const tenants = membershipRows.flatMap((row) => {
      const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
      if (!tenant || tenant.is_active !== true) return [];
      return [{
        id: tenant.id as string,
        name: tenant.name as string,
        slug: tenant.slug as string
      }];
    });

    return {
      success: true,
      data: tenants,
      meta: { requestId: request.id, timestamp: new Date().toISOString(), version: "v1", limit: 100 }
    };
  });

  app.get("/tenants/me", async (request) => ({
    success: true,
    data: request.tenantContext,
    meta: { requestId: request.id, timestamp: new Date().toISOString(), version: "v1" }
  }));
};
