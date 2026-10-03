# AGENTS.md — GROWTA ENGINEERING & AGENT GOVERNANCE CONTRACT

**Product:** Growta (AI-Native Agricultural Business Operating System)  
**Parent:** Varyanta Global Industries  
**Authority:** GROWTA-MASTER-PRD-001  
**Build Model:** Solo Founder + Antigravity AI Agents  

---

## 1. THE NON-HALLUCINATION CONTRACT (MANDATORY)

Every AI agent operating in this repository is strictly bound by the following rules:

1. **Hierarchy of Truth:**
   - Level 1: Approved requirements in `Growta_Master_PRD_Antigravity_Solo_Enterprise_v1-1.md`.
   - Level 2: Approved Architecture Decision Records (`docs/adr/`).
   - Level 3: Approved domain specifications (`docs/product/`).
   - Level 4: Existing production/prototype behavior explicitly accepted by the product owner.
   - Level 5: Approved UI/UX design specifications (`docs/ux/`).
   - Level 6: Existing code behavior, only when it does not contradict higher-level requirements.
   - Level 7: General software engineering best practice.

2. **Zero Inventions for Unknowns:**
   - Do NOT invent business rules, API schemas, pricing, statutory rates, user roles, or mock calculations when unspecified.
   - When an ambiguity or missing dependency is encountered, STOP and log an Open Question in `docs/open-questions/OQ-XXXX.md` with:
     - Question & Context
     - Why it matters
     - Options considered
     - Affected modules
     - Blocking vs. non-blocking status

3. **No Fake Completion:**
   - Never stub methods with empty bodies or dummy comments and mark the task as complete.
   - If an integration or backend is missing, report the dependency explicitly.

4. **Git Safety Rule:**
   - **DO NOT commit or push to Git** without explicit, verbal green-light approval from the product owner.

---

## 2. ARCHITECTURE RULES

1. **Modular Monolith First:**
   - Maintain clear domain boundaries within a unified backend service. Do not prematurely fragment into multiple microservices.
   - Services are split only when justified by scale, security isolation, or distinct runtime requirements (e.g., Python NeuronCore for AI/RAG).

2. **Layer Responsibilities:**
   - **Field Shell (Mobile/PWA):** Offline-first execution, GPS check-in, visit remarks, photo evidence, route execution, local SQLite/IDB.
   - **Enterprise Web Control Plane:** Admin console, SKU master, depot inventory, territory management, statutory muster rolls, BI analytics.
   - **Backend Platform:** System of record, multi-tenant isolation, authorization, transactional integrity, audit logs.
   - **NeuronCore:** Intelligence plane, RAG retrieval, crop knowledge embeddings, anomaly detection, AI evaluation.

3. **Existing Prototype Preservation:**
   - Do NOT delete or rewrite working prototype code during infrastructure setup.
   - All existing working features (1,146 Tier-A retailers, GPS check-ins, Bihar HQs, MGO 100-pt KPI scoring, dynamic forms, muster rolls, TA/DA calculator) are to be productized progressively.

---

## 3. SECURITY & DATA INTEGRITY RULES

1. **Multi-Tenancy:**
   - Every database query in multi-tenant tables MUST include `tenant_id` or `organization_id`.
   - Row-Level Security (RLS) policies must enforce isolation at the PostgreSQL layer.

2. **Audit Logging:**
   - All state-mutating actions (punch-in, order booking, TA/DA approval, dealer status update, inventory adjustments) must record an immutable audit trail (`user_id`, `tenant_id`, `timestamp`, `ip_address`, `action`, `entity_type`, `entity_id`, `diff`).

3. **Zero Hardcoded Secrets:**
   - API keys, service roles, and database passwords must reside strictly in `.env` / environment variables. Never commit credentials to version control.

---

## 4. ENGINEERING EXECUTION PROTOCOL (7-PHASE GATE)

For every module or task assigned, agents must follow:
- **PHASE A — DISCOVER:** Read PRD, ADRs, inspect existing code and tests. Do not edit files.
- **PHASE B — PLAN:** List affected files, schema changes, API endpoints, test cases, and open questions.
- **PHASE C — REVIEW:** Present plan for user review. Stop for approval if architecture changes.
- **PHASE D — IMPLEMENT:** Implement only approved scope. Reuse existing abstractions.
- **PHASE E — VERIFY:** Run build (`npm run build`), static analysis, unit/integration tests.
- **PHASE F — DOCUMENT:** Update data dictionary, API docs, changelog.
- **PHASE G — REPORT:** Detail files modified, test results, limitations, and next milestone.
