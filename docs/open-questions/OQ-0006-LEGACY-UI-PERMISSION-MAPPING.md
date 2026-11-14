# OQ-0006 — Mapping legacy field/admin UI capabilities to tenant permissions

**Status:** Blocking before the legacy UI is connected to tenant memberships  
**Date logged:** 2026-11-15  
**Module:** Legacy field/admin UI / authorization / tenant RBAC

## Question

How should the existing prototype's two broad UI modes (field representative and manager/admin) map to tenant-defined permissions without introducing a fixed global organogram or granting blanket access?

## Findings from checked-in code

1. `src/main.js` uses the boolean `auth.isAdmin` to unlock admin analytics, GPS audit, retailer reassignment, exports, and several other manager-only views.
2. `src/components/fieldView.js` filters retailer rows by a locally selected representative name and prompts for a locally verified station password.
3. `src/components/adminView.js` exposes representative passwords in the UI.
4. `packages/auth/rbac.js` contains a separate role/permission map, but the current main UI authorization still relies on the legacy boolean and local representative identity.
5. The tenant RBAC model intentionally supports tenant-specific role codes, permissions, designations, org units, and reporting structures. A universal `MANAGER` or `FIELD_REP` role would contradict that design.

## Why it matters

Replacing the local login with Supabase Auth alone does not secure the UI or its data. If the UI treats every authenticated member as `isAdmin`, it creates privilege escalation. If it treats an email, Auth metadata field, representative display name, or local storage value as an authorization claim, users can alter that value client-side.

The API must remain authoritative. UI capability checks are only presentation controls; every data request must independently enforce tenant, permission, and approved organizational scope on the server.

## Options

1. **Map to a fixed set of global roles** such as manager and field representative. Rejected because tenants may have different organograms and role names.
2. **Define granular permission codes for UI capabilities** and let each tenant role bundle them as needed. Recommended, provided permission codes are platform-governed and tenant roles remain tenant-defined.
3. **Treat any active membership as manager access.** Rejected as an immediate privilege-escalation vulnerability.

## Recommendation

Inventory each UI action and map it to one or more stable permission codes. Keep tenant-specific role names and designations independent from these capabilities. Replace `auth.isAdmin` checks with a derived capability set from the authenticated tenant context, but do not rely on client-side checks for API authorization.

At minimum, separately classify:
- tenant-wide read/reporting capabilities;
- field execution and own-record access;
- team/territory/org-scope reads;
- retailer assignment and master-data mutation;
- attendance, leave, TA/DA submission and approval;
- user, role, permission, and organization administration;
- exports and sensitive PII access.

Do not assign the broad legacy `STATE_HEAD` grants to a tenant membership until OQ-0002 is resolved. Do not infer permissions from an email address or a role label.

## Decisions required

- Approve the permission catalogue and the exact UI action-to-permission mapping.
- Define whether any UI features require multiple permissions (for example, read plus export).
- Define how tenant roles receive the granular permissions and how permission delegation is constrained by OQ-0001.
- Approve the own/team/org/tenant scope contract for each operational feature.

## Affected modules

`src/main.js`, `src/components/fieldView.js`, `src/components/adminView.js`, `src/services/auth.js`, `packages/auth/rbac.js`, API authorization guards, tenant permission catalogue, and audit events.

## Blocking status

**Blocking before the existing browser UI is enabled for tenant memberships or connected to tenant operational data.** No generic manager role or blanket authenticated-user access may be introduced as a shortcut.


## Interim implementation (2026-11-15)

A tenant capability catalogue now maps known application capabilities to explicit permission codes in `src/services/tenantCapabilities.js`. The auth service exposes `canCapability()`, and the tenant identity screen displays the capabilities derived from the API-returned permission list. Tests verify fail-closed behavior for missing context, unknown capabilities, and tenant role labels without grants.

This does **not** authorize the existing field/admin UI. The old views still contain broad `isAdmin` and local representative checks and still read legacy operational tables directly. Production tenant mode does not load those views. The complete per-action mapping, server-side scope rules, and API guards must be finished domain by domain before any old view is enabled for tenant memberships. OQ-0006 remains blocking for operational UI cutover.
