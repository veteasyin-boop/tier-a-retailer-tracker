import type { FastifyPluginAsync } from "fastify";
import type { SupabaseClients } from "../../platform/supabase.js";
import { permissionPreHandler } from "../authorization/require-permission.js";
import { createRoleSchema, roleListQuerySchema } from "./role.schemas.js";

type RouteOptions = { supabase: SupabaseClients };

export const roleRoutes: FastifyPluginAsync<RouteOptions> = async (app, { supabase }) => {
  app.get("/roles", {
    preHandler: permissionPreHandler("role.manage")
  }, async (request, reply) => {
    const parsed = roleListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: "INVALID_QUERY", message: "Role query parameters are invalid", details: parsed.error.issues },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }
    const context = request.tenantContext;
    if (!context) return reply.code(401).send({
      success: false, error: { code: "UNAUTHORIZED", message: "Tenant context is required", details: [] },
      meta: { requestId: request.id, timestamp: new Date().toISOString() }
    });

    let rolesQuery = supabase.admin.from("tenant_roles")
      .select("id,code,name,description,is_system,is_active,created_at", { count: "exact" })
      .eq("tenant_id", context.tenantId).order("name", { ascending: true })
      .range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1);
    if (!parsed.data.includeInactive) rolesQuery = rolesQuery.eq("is_active", true);

    const [rolesResult, permissionsResult] = await Promise.all([
      rolesQuery,
      supabase.admin.from("growta_permissions").select("code,category,description")
        .order("category", { ascending: true }).order("code", { ascending: true })
    ]);
    if (rolesResult.error || permissionsResult.error) {
      request.log.error({ err: rolesResult.error ?? permissionsResult.error, tenantId: context.tenantId }, "Tenant role catalogue query failed");
      return reply.code(500).send({
        success: false, error: { code: "ROLE_QUERY_FAILED", message: "Unable to retrieve tenant role configuration", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }

    const roles = rolesResult.data ?? [];
    const roleIds = roles.map((role) => role.id);
    let rolePermissionRows: { role_id: string; permission_code: string }[] = [];
    if (roleIds.length > 0) {
      const assignments = await supabase.admin.from("tenant_role_permissions")
        .select("role_id,permission_code").eq("tenant_id", context.tenantId).in("role_id", roleIds);
      if (assignments.error) {
        request.log.error({ err: assignments.error, tenantId: context.tenantId }, "Tenant role permissions query failed");
        return reply.code(500).send({
          success: false, error: { code: "ROLE_QUERY_FAILED", message: "Unable to retrieve role permissions", details: [] },
          meta: { requestId: request.id, timestamp: new Date().toISOString() }
        });
      }
      rolePermissionRows = assignments.data ?? [];
    }
    const permissionsByRole = new Map<string, string[]>();
    for (const assignment of rolePermissionRows) {
      const current = permissionsByRole.get(assignment.role_id) ?? [];
      current.push(assignment.permission_code);
      permissionsByRole.set(assignment.role_id, current);
    }
    return {
      success: true,
      data: {
        roles: roles.map((role) => ({ ...role, permissions: permissionsByRole.get(role.id) ?? [] })),
        permissionCatalog: permissionsResult.data ?? []
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString(), version: "v1",
        limit: parsed.data.limit, offset: parsed.data.offset, total: rolesResult.count ?? 0 }
    };
  });

  app.post("/roles", {
    preHandler: permissionPreHandler("role.manage")
  }, async (request, reply) => {
    const parsed = createRoleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false, error: { code: "INVALID_BODY", message: "Role payload is invalid",
          details: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }
    const context = request.tenantContext;
    if (!context) return reply.code(401).send({
      success: false, error: { code: "UNAUTHORIZED", message: "Tenant context is required", details: [] },
      meta: { requestId: request.id, timestamp: new Date().toISOString() }
    });

    const { data, error } = await supabase.admin.rpc("create_tenant_role_with_permissions", {
      p_tenant_id: context.tenantId,
      p_actor_user_id: context.userId,
      p_request_id: request.id,
      p_code: parsed.data.code,
      p_name: parsed.data.name,
      p_description: parsed.data.description ?? null,
      p_permission_codes: parsed.data.permissions
    });
    if (error) {
      if (error.code === "23505") return reply.code(409).send({
        success: false, error: { code: "ROLE_CODE_CONFLICT", message: "A role with this code already exists in this tenant", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
      if (error.code === "42501") return reply.code(403).send({
        success: false, error: { code: "PERMISSION_DENIED", message: "Role management permission is required", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
      if (error.code === "22023") return reply.code(400).send({
        success: false, error: { code: "INVALID_ROLE", message: "Role fields or permission codes are invalid", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
      request.log.error({ err: error, tenantId: context.tenantId }, "Tenant role creation failed");
      return reply.code(500).send({
        success: false, error: { code: "ROLE_CREATE_FAILED", message: "Unable to create tenant role", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }
    return reply.code(201).send({
      success: true, data,
      meta: { requestId: request.id, timestamp: new Date().toISOString(), version: "v1" }
    });
  });
};
