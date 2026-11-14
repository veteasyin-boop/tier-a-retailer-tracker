import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Read-only parser/integration check. A non-existent tenant UUID guarantees
// the query returns no application data and performs no writes.
const tenantId = "00000000-0000-4000-8000-000000000001";
const cursorCreatedAt = "2026-01-02T03:04:05.000Z";
const cursorId = "00000000-0000-4000-8000-000000000002";

const { data, error } = await supabase
  .from("growta_audit_events")
  .select("id")
  .eq("tenant_id", tenantId)
  .or(`created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`)
  .order("created_at", { ascending: false })
  .order("id", { ascending: false })
  .limit(1);

assert.equal(error, null, error?.message ?? "PostgREST rejected the audit cursor filter");
assert.deepEqual(data, []);
process.stdout.write("Audit composite keyset filter accepted by live PostgREST (read-only).\\n");
