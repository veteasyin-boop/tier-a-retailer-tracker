import type { FastifyPluginAsync } from "fastify";
import type { SupabaseClients } from "../../platform/supabase.js";
import { permissionPreHandler } from "../authorization/require-permission.js";
import { membershipStatusUpdateSchema } from "./membership.schemas.js";
import { z } from "zod";

type RouteOptions = { supabase: SupabaseClients };
const paramsSchema = z.object({ membershipId: z.string().uuid() }).strict();

export const membershipAdminRoutes: FastifyPluginAsync<RouteOptions> = async (app, { supabase }) => {
  app.patch("/memberships/:membershipId/status", {
    preHandler: permissionPreHandler("membership.manage")
  }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    const body = membershipStatusUpdateSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({
        success: false,
        error: { code: "INVALID_MEMBERSHIP_UPDATE", message: "Membership ID or status is invalid", details: [
          ...(!params.success ? params.error.issues : []), ...(!body.success ? body.error.issues : [])
        ] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }
    const context = request.tenantContext;
    if (!context) return reply.code(401).send({
      success: false, error: { code: "UNAUTHORIZED", message: "Tenant context is required", details: [] },
      meta: { requestId: request.id, timestamp: new Date().toISOString() }
    });
    const { data, error } = await supabase.admin.rpc("update_tenant_membership_status", {
      p_tenant_id: context.tenantId,
      p_actor_user_id: context.userId,
      p_request_id: request.id,
      p_membership_id: params.data.membershipId,
      p_status: body.data.status
    });
    if (error) {
      if (error.code === "42501") return reply.code(403).send({
        success: false, error: { code: "PERMISSION_DENIED", message: "Membership management permission is required", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
      if (error.code === "P0002") return reply.code(404).send({
        success: false, error: { code: "MEMBERSHIP_NOT_FOUND", message: "Membership does not exist in this tenant", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
      if (error.code === "55000") return reply.code(409).send({
        success: false, error: { code: "SELF_SUSPENSION_BLOCKED", message: "You cannot suspend your own tenant membership", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
      request.log.error({ err: error, tenantId: context.tenantId, membershipId: params.data.membershipId }, "Tenant membership status update failed");
      return reply.code(500).send({
        success: false, error: { code: "MEMBERSHIP_UPDATE_FAILED", message: "Unable to update membership status", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }
    return { success: true, data, meta: { requestId: request.id, timestamp: new Date().toISOString(), version: "v1" } };
  });
};
