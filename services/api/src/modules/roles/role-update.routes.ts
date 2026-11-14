import type { FastifyPluginAsync } from "fastify";
import type { SupabaseClients } from "../../platform/supabase.js";
import { permissionPreHandler } from "../authorization/require-permission.js";
import { updateRoleSchema } from "./role.schemas.js";
import { z } from "zod";

type RouteOptions = { supabase: SupabaseClients };
const roleParamsSchema = z.object({ roleId: z.string().uuid() }).strict();

export const roleUpdateRoutes: FastifyPluginAsync<RouteOptions> = async (app, { supabase }) => {
  app.patch("/roles/:roleId", {
    preHandler: permissionPreHandler("role.manage")
  }, async (request, reply) => {
    const params = roleParamsSchema.safeParse(request.params);
    const body = updateRoleSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({
        success: false,
        error: { code: "INVALID_ROLE_UPDATE", message: "Role ID or update payload is invalid", details: [
          ...(!params.success ? params.error.issues : []),
          ...(!body.success ? body.error.issues : [])
        ] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }
    const context = request.tenantContext;
    if (!context) return reply.code(401).send({
      success: false, error: { code: "UNAUTHORIZED", message: "Tenant context is required", details: [] },
      meta: { requestId: request.id, timestamp: new Date().toISOString() }
    });

    const { data, error } = await supabase.admin.rpc("update_tenant_role_with_permissions", {
      p_tenant_id: context.tenantId,
      p_actor_user_id: context.userId,
      p_request_id: request.id,
      p_role_id: params.data.roleId,
      p_name: body.data.name,
      p_description: body.data.description,
      p_is_active: body.data.isActive,
      p_permission_codes: body.data.permissions
    });
    if (error) {
      if (error.code === "42501") return reply.code(403).send({
        success: false, error: { code: "PERMISSION_DENIED", message: "Role management permission is required", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
      if (error.code === "P0002") return reply.code(404).send({
        success: false, error: { code: "ROLE_NOT_FOUND", message: "Role does not exist in this tenant", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
      if (error.code === "23514") return reply.code(409).send({
        success: false, error: { code: "ROLE_STILL_ASSIGNED", message: "Reassign active members before deactivating this role", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
      if (error.code === "55000") return reply.code(409).send({
        success: false, error: { code: "SYSTEM_ROLE_IMMUTABLE", message: "System roles cannot be modified", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
      if (error.code === "22023") return reply.code(400).send({
        success: false, error: { code: "INVALID_ROLE", message: "Role fields or permission codes are invalid", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
      request.log.error({ err: error, tenantId: context.tenantId, roleId: params.data.roleId }, "Tenant role update failed");
      return reply.code(500).send({
        success: false, error: { code: "ROLE_UPDATE_FAILED", message: "Unable to update tenant role", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }
    return { success: true, data, meta: { requestId: request.id, timestamp: new Date().toISOString(), version: "v1" } };
  });
};
