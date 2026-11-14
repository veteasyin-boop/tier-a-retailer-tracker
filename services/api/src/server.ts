import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { createSupabaseClients } from "./platform/supabase.js";

const config = loadConfig();
const app = await buildApp({ config, supabase: createSupabaseClients(config) });

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error({ err: error }, "API startup failed");
  await app.close();
  process.exitCode = 1;
}
