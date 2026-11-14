import type { FastifyPluginAsync } from "fastify";
import type { SupabaseClients } from "../../platform/supabase.js";
import { auditCursorSchema, auditListQuerySchema } from "./audit.schemas.js";
import { requirePermission } from "../authorization/require-permission.js";

type RouteOptions = { supabase: SupabaseClients };

export const auditRoutes: FastifyPluginAsync<RouteOptions> = async (app, { supabase }) => {
  app.get("/audit-events", {
    preHandler: async (request) => { requirePermission(request.tenantContext, "audit.read"); }
  }, async (request, reply) => {
    const parsed = auditListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: {
          code: "INVALID_QUERY",
          message: "Audit query parameters are invalid",
          details: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }
    const context = request.tenantContext;
    if (!context) {
      return reply.code(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Tenant context is required", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }

    let cursor: { createdAt: string; id: string } | null = null;
    if (parsed.data.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(parsed.data.cursor, "base64url").toString("utf8")) as unknown;
        const cursorResult = auditCursorSchema.safeParse(decoded);
        if (!cursorResult.success) throw new Error("Invalid cursor");
        cursor = cursorResult.data;
      } catch {
        return reply.code(400).send({
          success: false,
          error: { code: "INVALID_CURSOR", message: "Audit cursor is invalid", details: [] },
          meta: { requestId: request.id, timestamp: new Date().toISOString() }
        });
      }
    }

    let query = supabase.admin.from("growta_audit_events")
      .select("id,actor_user_id,request_id,action,entity_type,entity_id,before_data,after_data,metadata,created_at")
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(parsed.data.limit + 1);
    if (cursor) query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
    if (parsed.data.entityType) query = query.eq("entity_type", parsed.data.entityType);

    const { data, error } = await query;
    if (error) {
      request.log.error({ err: error, tenantId: context.tenantId }, "Audit query failed");
      return reply.code(500).send({
        success: false,
        error: { code: "AUDIT_QUERY_FAILED", message: "Unable to retrieve audit events", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }

    const rows = data ?? [];
    const hasMore = rows.length > parsed.data.limit;
    const page = hasMore ? rows.slice(0, parsed.data.limit) : rows;
    const last = page.length ? page[page.length - 1] : null;
    const nextCursor = hasMore && last
      ? Buffer.from(JSON.stringify({ createdAt: last.created_at, id: last.id }), "utf8").toString("base64url")
      : null;

    return {
      success: true,
      data: page,
      meta: { requestId: request.id, timestamp: new Date().toISOString(), version: "v1", limit: parsed.data.limit, nextCursor }
    };
  });
};
