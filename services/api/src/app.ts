import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import rateLimit from "@fastify/rate-limit";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "./config.js";
import type { SupabaseClients } from "./platform/supabase.js";
import { parseTenantId, resolveTenantContext, TenantContextError, type TenantContext } from "./modules/identity/tenant-context.js";
import { permissionPreHandler } from "./modules/authorization/require-permission.js";
import { auditListQuerySchema } from "./modules/audit/audit.schemas.js";

declare module "fastify" {
  interface FastifyRequest {
    tenantContext: TenantContext | null;
  }
}

type Dependencies = { config: AppConfig; supabase: SupabaseClients };

export async function buildApp({ config, supabase }: Dependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.nodeEnv !== "test",
    trustProxy: false,
    bodyLimit: 1024 * 1024,
    genReqId: () => randomUUID()
  });

  app.decorateRequest("tenantContext", null);
  await app.register(cors, { origin: config.corsOrigins, credentials: false });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error, requestId: request.id }, "Request failed");
    const candidateStatus = typeof error === "object" && error !== null && "statusCode" in error
      ? (error as { statusCode?: unknown }).statusCode : undefined;
    const statusCode = typeof candidateStatus === "number" && candidateStatus >= 400 && candidateStatus < 600
      ? candidateStatus : 500;
    const errorMessage = error instanceof Error ? error.message : "Request failed";
    const errorCode = typeof error === "object" && error !== null && "code" in error
      && typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : statusCode === 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED";
    return reply.code(statusCode).send({
      success: false,
      error: {
        code: errorCode,
        message: statusCode === 500 ? "An unexpected error occurred" : errorMessage,
        details: []
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() }
    });
  });

  app.get("/health", async () => ({
    success: true,
    data: { status: "ok" },
    meta: { timestamp: new Date().toISOString(), version: "v1" }
  }));

  app.addHook("preHandler", async (request, reply) => {
    if (request.url === "/health") return;

    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      return reply.code(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Bearer token is required", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }

    const token = authorization.slice("Bearer ".length).trim();
    if (!token || token.length > 8192) {
      return reply.code(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Bearer token is invalid", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }

    const { data, error } = await supabase.auth.auth.getUser(token);
    if (error || !data.user) {
      return reply.code(401).send({
        success: false,
        error: { code: "INVALID_TOKEN", message: "Authentication token is invalid or expired", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }

    try {
      const tenantId = parseTenantId(request.headers["x-tenant-id"]);
      request.tenantContext = await resolveTenantContext(supabase.admin, data.user, tenantId);
    } catch (error) {
      if (error instanceof TenantContextError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: { code: error.code, message: error.message, details: [] },
          meta: { requestId: request.id, timestamp: new Date().toISOString() }
        });
      }
      throw error;
    }
  });


  app.get("/api/v1/audit-events", {
    preHandler: permissionPreHandler("audit.read")
  }, async (request, reply) => {
    const parsed = auditListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: {
          code: "INVALID_QUERY",
          message: "Audit query parameters are invalid",
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
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

    let query = supabase.admin
      .from("growta_audit_events")
      .select("id,actor_user_id,request_id,action,entity_type,entity_id,before_data,after_data,metadata,created_at")
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(parsed.data.limit);

    if (parsed.data.before) query = query.lt("created_at", parsed.data.before);
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

    return {
      success: true,
      data: data ?? [],
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
        version: "v1",
        limit: parsed.data.limit,
        nextBefore: data?.length ? data[data.length - 1]?.created_at ?? null : null
      }
    };
  });

  app.get("/api/v1/tenants/me", async (request) => {
    return {
      success: true,
      data: request.tenantContext,
      meta: { requestId: request.id, timestamp: new Date().toISOString(), version: "v1" }
    };
  });

  return app;
}
