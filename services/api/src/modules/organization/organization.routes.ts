import type { FastifyPluginAsync } from "fastify";
import type { SupabaseClients } from "../../platform/supabase.js";
import { organizationListQuerySchema } from "./organization.schemas.js";
import { permissionPreHandler } from "../authorization/require-permission.js";

type RouteOptions = { supabase: SupabaseClients };

export const organizationRoutes: FastifyPluginAsync<RouteOptions> = async (app, { supabase }) => {
  app.get("/unit-types", {
    preHandler: permissionPreHandler("organization.read")
  }, async (request, reply) => {
    const parsed = organizationListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: "INVALID_QUERY", message: "Organization query parameters are invalid", details: parsed.error.issues },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }
    const context = request.tenantContext;
    if (!context) return reply.code(401).send({ success: false, error: { code: "UNAUTHORIZED", message: "Tenant context is required", details: [] } });
    let query = supabase.admin.from("org_unit_types")
      .select("id,tenant_id,code,name,description,sort_order,is_active,created_at", { count: "exact" })
      .eq("tenant_id", context.tenantId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1);
    if (parsed.data.includeInactive !== "true") query = query.eq("is_active", true);
    const { data, count, error } = await query;
    if (error) {
      request.log.error({ err: error, tenantId: context.tenantId }, "Organization unit type query failed");
      return reply.code(500).send({ success: false, error: { code: "ORGANIZATION_QUERY_FAILED", message: "Unable to retrieve organization unit types", details: [] }, meta: { requestId: request.id, timestamp: new Date().toISOString() } });
    }
    return { success: true, data: data ?? [], meta: { requestId: request.id, timestamp: new Date().toISOString(), version: "v1", limit: parsed.data.limit, offset: parsed.data.offset, total: count ?? 0 } };
  });

  app.get("/units", {
    preHandler: permissionPreHandler("organization.read")
  }, async (request, reply) => {
    const parsed = organizationListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: "INVALID_QUERY", message: "Organization query parameters are invalid", details: parsed.error.issues },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }
    const context = request.tenantContext;
    if (!context) return reply.code(401).send({ success: false, error: { code: "UNAUTHORIZED", message: "Tenant context is required", details: [] } });
    let query = supabase.admin.from("org_units")
      .select("id,tenant_id,unit_type_id,parent_id,code,name,description,is_active,created_at,updated_at", { count: "exact" })
      .eq("tenant_id", context.tenantId)
      .order("code", { ascending: true })
      .range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1);
    if (parsed.data.includeInactive !== "true") query = query.eq("is_active", true);
    if (parsed.data.parentId) query = query.eq("parent_id", parsed.data.parentId);
    if (parsed.data.rootsOnly === "true") query = query.is("parent_id", null);
    const { data, count, error } = await query;
    if (error) {
      request.log.error({ err: error, tenantId: context.tenantId }, "Organization unit query failed");
      return reply.code(500).send({ success: false, error: { code: "ORGANIZATION_QUERY_FAILED", message: "Unable to retrieve organization units", details: [] }, meta: { requestId: request.id, timestamp: new Date().toISOString() } });
    }
    return { success: true, data: data ?? [], meta: { requestId: request.id, timestamp: new Date().toISOString(), version: "v1", limit: parsed.data.limit, offset: parsed.data.offset, total: count ?? 0 } };
  });

  app.get("/designations", {
    preHandler: permissionPreHandler("organization.read")
  }, async (request, reply) => {
    const parsed = organizationListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: "INVALID_QUERY", message: "Organization query parameters are invalid", details: parsed.error.issues },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }
    const context = request.tenantContext;
    if (!context) return reply.code(401).send({ success: false, error: { code: "UNAUTHORIZED", message: "Tenant context is required", details: [] } });
    let query = supabase.admin.from("designations")
      .select("id,tenant_id,code,name,description,is_active,created_at", { count: "exact" })
      .eq("tenant_id", context.tenantId)
      .order("name", { ascending: true })
      .range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1);
    if (parsed.data.includeInactive !== "true") query = query.eq("is_active", true);
    const { data, count, error } = await query;
    if (error) {
      request.log.error({ err: error, tenantId: context.tenantId }, "Designation query failed");
      return reply.code(500).send({ success: false, error: { code: "ORGANIZATION_QUERY_FAILED", message: "Unable to retrieve designations", details: [] }, meta: { requestId: request.id, timestamp: new Date().toISOString() } });
    }
    return { success: true, data: data ?? [], meta: { requestId: request.id, timestamp: new Date().toISOString(), version: "v1", limit: parsed.data.limit, offset: parsed.data.offset, total: count ?? 0 } };
  });
};
