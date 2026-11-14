import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

// This integration test creates immutable audit rows and is intentionally
// restricted to the disposable local Supabase instance used by CI.
const hostname = new URL(supabaseUrl).hostname;
assert.ok(
  ["127.0.0.1", "localhost", "::1"].includes(hostname),
  "Audit pagination fixtures may only be written to local Supabase"
);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const tenantId = "a0000000-0000-0000-0000-000000000001";
const entityType = `pagination-test-${randomUUID()}`;
const createdAt = "2026-01-02T03:04:05.000Z";
const fixtureIds = Array.from({ length: 5 }, () => randomUUID());
const email = `audit-pagination-${randomUUID()}@example.test`;

const { data: userResult, error: userError } = await supabase.auth.admin.createUser({
  email,
  password: randomUUID(),
  email_confirm: true
});

assert.equal(userError, null, userError?.message ?? "Unable to create local audit test user");
assert.ok(userResult.user, "Supabase Auth did not return the fixture user");
const actorUserId = userResult.user.id;

const { data: inserted, error: insertError } = await supabase
  .from("growta_audit_events")
  .insert(fixtureIds.map((id, index) => ({
    id,
    tenant_id: tenantId,
    actor_user_id: actorUserId,
    request_id: `audit-pagination-${randomUUID()}`,
    action: "test.pagination",
    entity_type: entityType,
    entity_id: `fixture-${index}`,
    metadata: { source: "local-postgrest-pagination-integration" },
    created_at: createdAt
  })))
  .select("id,created_at");

assert.equal(insertError, null, insertError?.message ?? "Unable to insert local audit fixtures");
assert.equal(inserted?.length, fixtureIds.length, "Expected all audit fixtures to be inserted");

type AuditCursor = { createdAt: string; id: string };

async function fetchPage(cursor?: AuditCursor) {
  let query = supabase
    .from("growta_audit_events")
    .select("id,created_at")
    .eq("tenant_id", tenantId)
    .eq("entity_type", entityType);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(2);

  assert.equal(error, null, error?.message ?? "PostgREST rejected the audit keyset query");
  return data ?? [];
}

const firstPage = await fetchPage();
assert.equal(firstPage.length, 2, "First page should contain two rows");

const secondPage = await fetchPage({
  createdAt: firstPage[1].created_at,
  id: firstPage[1].id
});
assert.equal(secondPage.length, 2, "Second page should contain two rows");

const thirdPage = await fetchPage({
  createdAt: secondPage[1].created_at,
  id: secondPage[1].id
});
assert.equal(thirdPage.length, 1, "Third page should contain the final row");

const allPages = [...firstPage, ...secondPage, ...thirdPage];
const actualIds = allPages.map((row) => row.id);
const expectedIds = [...fixtureIds].sort((left, right) => right.localeCompare(left));

assert.deepEqual(actualIds, expectedIds, "Keyset pagination must neither skip nor duplicate audit rows");
assert.equal(new Set(actualIds).size, fixtureIds.length, "Keyset pagination returned duplicate IDs");

const afterLastPage = await fetchPage({
  createdAt: thirdPage[0].created_at,
  id: thirdPage[0].id
});
assert.deepEqual(afterLastPage, [], "No rows should remain after the final cursor");

process.stdout.write(
  "Audit keyset pagination passed against local PostgREST: 5 rows, 3 pages, no duplicates or skips.\\n"
);
