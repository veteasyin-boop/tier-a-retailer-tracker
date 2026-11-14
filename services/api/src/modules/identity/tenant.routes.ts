import type { FastifyPluginAsync } from "fastify";

export const tenantRoutes: FastifyPluginAsync = async (app) => {
  app.get("/tenants/me", async (request) => ({
    success: true,
    data: request.tenantContext,
    meta: { requestId: request.id, timestamp: new Date().toISOString(), version: "v1" }
  }));
};
