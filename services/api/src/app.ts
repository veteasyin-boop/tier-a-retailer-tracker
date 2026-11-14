import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "./config.js";
import type { SupabaseClients } from "./platform/supabase.js";
import { parseTenantId, resolveTenantContext, TenantContextError } from "./modules/identity/tenant-context.js";
import { organizationRoutes } from "./modules/organization/organization.routes.js";
import { auditRoutes } from "./modules/audit/audit.routes.js";
import { tenantRoutes } from "./modules/identity/tenant.routes.js";

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

  // Parent hook applies to registered route plugins. Health is the only public route.
  app.addHook("preHandler", async (request, reply) => {
    if (request.routeOptions.url === "/health") return;

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

  await app.register(organizationRoutes, { prefix: "/api/v1/organization", supabase });
  await app.register(auditRoutes, { prefix: "/api/v1", supabase });
  await app.register(tenantRoutes, { prefix: "/api/v1" });

  return app;
}
