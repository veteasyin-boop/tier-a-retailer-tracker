import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import type { SupabaseClients } from "../../platform/supabase.js";

type RouteOptions = { supabase: SupabaseClients };
const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(3).max(63).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  tier: z.string().trim().min(2).max(40).default("standard")
}).strict();
const tenantStatusSchema = z.object({ isActive: z.boolean() }).strict();
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  search: z.string().trim().max(100).optional()
}).strict();

async function requirePlatformAdmin(request: any, reply: any, supabase: SupabaseClients): Promise<boolean> {
  const user = request.authUser;
  if (!user) {
    await reply.code(401).send({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required", details: [] } });
    return false;
  }
  const { data, error } = await supabase.admin.from("platform_admins").select("status").eq("user_id", user.id).maybeSingle();
  if (error) {
    request.log.error({ err: error, userId: user.id }, "Platform admin verification failed");
    await reply.code(500).send({ success: false, error: { code: "PLATFORM_ADMIN_LOOKUP_FAILED", message: "Unable to verify platform administrator access", details: [] } });
    return false;
  }
  if (data?.status !== "active") {
    await reply.code(403).send({ success: false, error: { code: "PLATFORM_ADMIN_REQUIRED", message: "Active platform administrator access is required", details: [] } });
    return false;
  }
  return true;
}

export const platformAdminRoutes: FastifyPluginAsync<RouteOptions> = async (app, { supabase }) => {
  app.get("/platform/admin/me", async (request, reply) => {
    const user = request.authUser;
    if (!user) return reply.code(401).send({ success: false, error: { code: "UNAUTHORIZED", message: "A valid authenticated user is required", details: [] } });
    const { data, error } = await supabase.admin.from("platform_admins").select("status,created_at").eq("user_id", user.id).maybeSingle();
    if (error) {
      request.log.error({ err: error, userId: user.id }, "Platform admin lookup failed");
      return reply.code(500).send({ success: false, error: { code: "PLATFORM_ADMIN_LOOKUP_FAILED", message: "Unable to verify platform administrator access", details: [] } });
    }
    const active = data?.status === "active";
    return reply.code(active ? 200 : 403).send({
      success: active, data: active ? { userId: user.id, email: user.email ?? null, status: "active" } : null,
      error: active ? undefined : { code: "PLATFORM_ADMIN_REQUIRED", message: "This account does not have active platform administrator access", details: [] },
      meta: { requestId: request.id, timestamp: new Date().toISOString(), version: "v1" }
    });
  });

  app.get("/platform/admin/tenants", async (request, reply) => {
    if (!await requirePlatformAdmin(request, reply, supabase)) return;
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ success: false, error: { code: "INVALID_QUERY", message: "Tenant list query is invalid", details: parsed.error.issues } });
    let query = supabase.admin.from("tenants").select("id,name,slug,tier,is_active,created_at,updated_at", { count: "exact" })
      .order("created_at", { ascending: false }).range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1);
    if (parsed.data.search) {
      const term = parsed.data.search.replace(/[%_,]/g, "");
      query = query.or(`name.ilike.%${term}%,slug.ilike.%${term}%`);
    }
    const { data, error, count } = await query;
    if (error) {
      request.log.error({ err: error }, "Platform tenant listing failed");
      return reply.code(500).send({ success: false, error: { code: "TENANT_LIST_FAILED", message: "Unable to list tenants", details: [] } });
    }
    return { success: true, data: data ?? [], meta: { requestId: request.id, timestamp: new Date().toISOString(), limit: parsed.data.limit, offset: parsed.data.offset, total: count ?? 0 } };
  });

  app.post("/platform/admin/tenants", async (request, reply) => {
    if (!await requirePlatformAdmin(request, reply, supabase)) return;
    const parsed = createTenantSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: { code: "INVALID_BODY", message: "Tenant payload is invalid", details: parsed.error.issues } });
    const { data, error } = await supabase.admin.rpc("platform_create_tenant", {
      p_actor_user_id: request.authUser!.id, p_request_id: request.id, p_name: parsed.data.name,
      p_slug: parsed.data.slug, p_tier: parsed.data.tier
    });
    if (error) {
      if (error.code === "23505") return reply.code(409).send({ success: false, error: { code: "TENANT_SLUG_CONFLICT", message: "A tenant with this slug already exists", details: [] } });
      if (error.code === "42501") return reply.code(403).send({ success: false, error: { code: "PLATFORM_ADMIN_REQUIRED", message: "Active platform administrator access is required", details: [] } });
      request.log.error({ err: error }, "Platform tenant creation failed");
      return reply.code(500).send({ success: false, error: { code: "TENANT_CREATE_FAILED", message: "Unable to create tenant", details: [] } });
    }
    return reply.code(201).send({ success: true, data, meta: { requestId: request.id, timestamp: new Date().toISOString(), version: "v1" } });
  });

  app.patch("/platform/admin/tenants/:tenantId/status", async (request, reply) => {
    if (!await requirePlatformAdmin(request, reply, supabase)) return;
    const params = z.object({ tenantId: z.string().uuid() }).safeParse(request.params);
    const body = tenantStatusSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ success: false, error: { code: "INVALID_REQUEST", message: "Tenant ID or status payload is invalid", details: [...(params.success ? [] : params.error.issues), ...(body.success ? [] : body.error.issues)] } });
    const { data, error } = await supabase.admin.rpc("platform_set_tenant_status", {
      p_actor_user_id: request.authUser!.id, p_request_id: request.id,
      p_tenant_id: params.data.tenantId, p_is_active: body.data.isActive
    });
    if (error) {
      if (error.code === "P0002") return reply.code(404).send({ success: false, error: { code: "TENANT_NOT_FOUND", message: "Tenant does not exist", details: [] } });
      if (error.code === "42501") return reply.code(403).send({ success: false, error: { code: "PLATFORM_ADMIN_REQUIRED", message: "Active platform administrator access is required", details: [] } });
      request.log.error({ err: error }, "Platform tenant status update failed");
      return reply.code(500).send({ success: false, error: { code: "TENANT_STATUS_UPDATE_FAILED", message: "Unable to update tenant status", details: [] } });
    }
    return { success: true, data, meta: { requestId: request.id, timestamp: new Date().toISOString(), version: "v1" } };
  });

  app.get("/platform/admin/audit-events", async (request, reply) => {
    if (!await requirePlatformAdmin(request, reply, supabase)) return;
    const parsed = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).max(100000).default(0) }).safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ success: false, error: { code: "INVALID_QUERY", message: "Audit query is invalid", details: parsed.error.issues } });
    const { data, error, count } = await supabase.admin.from("platform_audit_events")
      .select("id,actor_user_id,request_id,action,entity_type,entity_id,before_data,after_data,metadata,created_at", { count: "exact" })
      .order("created_at", { ascending: false }).range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1);
    if (error) {
      request.log.error({ err: error }, "Platform audit query failed");
      return reply.code(500).send({ success: false, error: { code: "PLATFORM_AUDIT_QUERY_FAILED", message: "Unable to retrieve platform audit events", details: [] } });
    }
    return { success: true, data: data ?? [], meta: { requestId: request.id, timestamp: new Date().toISOString(), limit: parsed.data.limit, offset: parsed.data.offset, total: count ?? 0 } };
  });
};
