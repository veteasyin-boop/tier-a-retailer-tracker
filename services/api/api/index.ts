import type { IncomingMessage, ServerResponse } from "node:http";
import { loadConfig } from "../src/config.js";
import { buildApp } from "../src/app.js";
import { createSupabaseClients } from "../src/platform/supabase.js";

type Runtime = { ready: Promise<void>; app: Awaited<ReturnType<typeof buildApp>> };
let runtime: Runtime | undefined;

function getRuntime(): Runtime {
  if (!runtime) {
    const config = loadConfig({ ...process.env, HOST: "0.0.0.0" });
    const app = buildApp({ config, supabase: createSupabaseClients(config) });
    runtime = { app, ready: app.then((instance) => instance.ready()) };
  }
  return runtime;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const current = getRuntime();
    await current.ready;
    current.app.server.emit("request", req, res);
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
