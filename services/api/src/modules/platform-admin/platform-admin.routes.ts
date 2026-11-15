import type { FastifyPluginAsync } from "fastify";
import type { SupabaseClients } from "../../platform/supabase.js";

type RouteOptions = { supabase: SupabaseClients };

export const platformAdminRoutes: FastifyPluginAsync<RouteOptions> = async (app, { supabase }) => {
  app.get("/platform/admin/me", async (request, reply) => {
    const user = request.authUser;
    if (!user) {
      return reply.code(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "A valid authenticated user is required", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }

    const { data, error } = await supabase.admin
      .from("platform_admins")
      .select("status,created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      request.log.error({ err: error, userId: user.id }, "Platform admin lookup failed");
      return reply.code(500).send({
        success: false,
        error: { code: "PLATFORM_ADMIN_LOOKUP_FAILED", message: "Unable to verify platform administrator access", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }

    const isPlatformAdmin = data?.status === "active";
    return reply.code(isPlatformAdmin ? 200 : 403).send({
      success: isPlatformAdmin,
      data: isPlatformAdmin ? { userId: user.id, email: user.email ?? null, status: "active" } : null,
      error: isPlatformAdmin ? undefined : {
        code: "PLATFORM_ADMIN_REQUIRED",
        message: "This account does not have active platform administrator access",
        details: []
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString(), version: "v1" }
    });
  });
};
