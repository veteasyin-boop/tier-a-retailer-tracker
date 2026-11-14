import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";
import { loadConfig } from "../src/config.js";
import { buildApp } from "../src/app.js";
import { createSupabaseClients } from "../src/platform/supabase.js";

let appPromise: Promise<FastifyInstance> | undefined;

function getApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    const config = loadConfig({ ...process.env, HOST: "0.0.0.0" });
    appPromise = buildApp({ config, supabase: createSupabaseClients(config) });
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const app = await getApp();
    await app.ready();
    app.server.emit("request", req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "API initialization failed";
    console.error("Growta API serverless initialization failed", message);
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        success: false,
        error: { code: "API_UNAVAILABLE", message: "API is temporarily unavailable", details: [] },
        meta: { timestamp: new Date().toISOString() }
      }));
    }
  }
}
