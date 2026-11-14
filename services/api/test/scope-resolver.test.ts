import test from "node:test";
import assert from "node:assert/strict";
import { resolveScopeUnitIds } from "../src/modules/authorization/scope-resolver.js";

test("expands descendants only when explicitly requested", () => {
  const units = [
    { id: "root", parent_id: null },
    { id: "child", parent_id: "root" },
    { id: "grandchild", parent_id: "child" },
    { id: "sibling", parent_id: "root" },
    { id: "other-root", parent_id: null }
  ];

  assert.deepEqual(
    resolveScopeUnitIds([{ org_unit_id: "child", include_descendants: true }], units),
    ["child", "grandchild"]
  );
});

test("does not infer access from primary placement or unknown scope ids", () => {
  const units = [{ id: "root", parent_id: null }];
  assert.deepEqual(
    resolveScopeUnitIds([{ org_unit_id: "missing", include_descendants: true }], units),
    []
  );
});

test("deduplicates overlapping scopes", () => {
  const units = [
    { id: "root", parent_id: null },
    { id: "child", parent_id: "root" }
  ];
  assert.deepEqual(
    resolveScopeUnitIds([
      { org_unit_id: "root", include_descendants: true },
      { org_unit_id: "child", include_descendants: false }
    ], units),
    ["child", "root"]
  );
});


test("expands a wide hierarchy without repeated front-of-array removal", () => {
  const units = [
    { id: "root", parent_id: null },
    ...Array.from({ length: 2000 }, (_, index) => ({
      id: `child-${index}`,
      parent_id: "root"
    }))
  ];
  const resolved = resolveScopeUnitIds(
    [{ org_unit_id: "root", include_descendants: true }],
    units
  );
  assert.equal(resolved.length, 2001);
});
