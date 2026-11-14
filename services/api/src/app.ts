import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import rateLimit from "@fastify/rate-limit";
import type { AppConfig } from "./config.js";
import type { SupabaseClients } from "./platform/supabase.js";
import { parseTenantId, resolveTenantContext, TenantContextError, type TenantContext } from "./modules/identity/tenant-context.js";

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
    genReqId: () => crypto.randomUUID()
  });

  app.decorateRequest("tenantContext", null);
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error, requestId: request.id }, "Request failed");
    const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode : 500;
    return reply.code(statusCode).send({
      success: false,
      error: {
        code: statusCode === 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED",
        message: statusCode === 500 ? "An unexpected error occurred" : error.message,
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

  app.get("/api/v1/tenants/me", async (request) => {
    return {
      success: true,
      data: request.tenantContext,
      meta: { requestId: request.id, timestamp: new Date().toISOString(), version: "v1" }
    };
  });

  return app;
}
