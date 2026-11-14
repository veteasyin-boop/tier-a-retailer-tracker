# OPEN QUESTIONS (OQ) REGISTRY — GROWTA

**Authority:** GROWTA-MASTER-PRD-001 (Section 1.2)  
**Standard:** Every unspecified requirement, ambiguous business rule, or missing integration MUST be logged here as an individual document `OQ-XXXX.md`.  
**Rule:** Agents MUST NOT invent behavior when an open question is unresolved.

---

| OQ ID | Title | Module | Status | Date Logged |
| :--- | :--- | :--- | :--- | :--- |
| OQ-0001 | Initial tenant-owner bootstrap and permission delegation | Identity / RBAC | Blocking | 2026-11-15 |
| OQ-0002 | Legacy STATE_HEAD role authorization semantics | Identity / legacy RBAC | Blocking before legacy role assignment / operational API access | 2026-11-15 |
| OQ-0003 | Database authorization context for tenant API queries | API / database authorization | Blocking before new tenant operational-data APIs | 2026-11-15 |
| OQ-0004 | Legacy browser data-plane tenant isolation and authentication | Legacy field operations / multi-tenancy | Blocking before multi-tenant onboarding | 2026-11-15 |
| OQ-0005 | Offline sync identity binding, idempotency, and rejected-operation recovery | Field Shell / offline sync / API mutations | Blocking before operational write endpoints | 2026-11-15 |
