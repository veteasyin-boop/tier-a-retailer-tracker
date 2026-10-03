# PROTOTYPE ARCHAEOLOGY REPORT — GROWTA (AGRIFIELD PRO / BIHAR GRID)

**Document ID:** GROWTA-ARCH-001  
**Authority:** GROWTA-MASTER-PRD-001 (Section 77, 78, 108)  
**Status:** Complete Prototype Inventory & Specification Baseline  
**Date:** 2026-10-04  
**Auditor:** Antigravity AI Agent  

---

## 1. EXECUTIVE SUMMARY

This report provides the exhaustive technical archaeology of the current working prototype (**AgriField Pro / Bihar Grid Field Operations Platform**). 
All business logic, formulas, mathematical models, UI modal layouts, and database schemas inventoried below constitute the **functional baseline** to be preserved and productized into Growta Enterprise OS without regressions.

---

## 2. TERRITORY, SEED DATA & ORGANIZATIONAL BASELINE

The current prototype operates across the central agricultural belt of Bihar, India:

- **Target Market:** Bihar Agri-Dealers (Seed, Agrochemicals, Fertilizers).
- **Core Database Size:** 1,146 verified Tier-A retail counters seeded into Supabase.
- **8 Primary Operational HQs & Representative Allocation:**
  1. **Bihta HQ (Patna District):** Allocated Blocks: Bihta, Maner, Naubatpur. Target: 50 counters.
  2. **Danapur HQ (Patna District):** Allocated Blocks: Danapur, Phulwari Sharif, Dinapur-Cum-Khagaul. Target: 50 counters.
  3. **Masaurhi HQ (Patna District):** Allocated Blocks: Masaurhi, Punpun, Dhanarua. Target: 45 counters.
  4. **Fatuha HQ (Patna District):** Allocated Blocks: Fatuha, Daniyawan, Sampatchak. Target: 45 counters.
  5. **Bakhtiarpur HQ (Patna District):** Allocated Blocks: Bakhtiarpur, Khusrupur, Athmalgola. Target: 40 counters.
  6. **Barh HQ (Patna District):** Allocated Blocks: Barh, Belchhi, Pandarak. Target: 40 counters.
  7. **Mokama HQ (Patna District):** Allocated Blocks: Mokama, Ghoswari. Target: 35 counters.
  8. **Paliganj HQ (Patna District):** Allocated Blocks: Paliganj, Bikram, Dulhin Bazar. Target: 40 counters.

---

## 3. COMPONENT & SCREEN INVENTORY

The prototype consists of two main user surfaces implemented in modular JavaScript:

### 3.1 Field Execution Shell (`src/components/fieldView.js`)
- **Header Console:** Rep profile, battery level, online/offline status, quick GPS sync.
- **Hero Shift Console:** Daily punch-in, punch-out, shift timer, location watermarking.
- **Bento Grid KPIs:** Today's visits counter, km logged, pending tour tasks, order pipeline.
- **Counter Directory List:** 573 Tier-A dealers filtered by HQ/Block, distance sorting, search.
- **Counter Detail Bottom Sheet:** Dealer phone call, GPS check-in trigger, visit remarks, order booking.
- **Today's Tour Beat View:** Sequenced beat route with TSP order, completed vs. pending stops.
- **Field SOP Operating Rhythm:** 10-step daily discipline tracker.

### 3.2 Enterprise Web Admin Console (`src/components/adminView.js`)
- **Executive SaaS Header:** Role indicator, fleet speed alert trigger, instant Cloud Sync & Refresh button.
- **11 Management Tabs:**
  1. `leaderboard`: MGO 100-Point performance leaderboard, supervisory action strip.
  2. `retailers`: 1,146 counter master directory, pagination, bulk territory reassignments, Excel import/export.
  3. `attendance`: Statutory Muster Roll (Form XVI / Form D), Sunday WO, Gazetted holiday bulk markers.
  4. `eod`: Daily EOD closing reports inbox, managerial review & feedback dispatcher.
  5. `quiz`: Agronomy knowledge test manager, question creator, cycle reset.
  6. `forms`: Dynamic visual form builder, custom field creator, submission auditor.
  7. `inventory`: Depot stock allocations, rep demo kits, liquidation reconciliation.
  8. `tada`: GPS distance vs. odometer claims, audit flag engine, managerial approvals.
  9. `beats`: Smart beat planner, TSP route optimizer, monthly calendar beats.
  10. `speed`: Fleet speed audit, over-speeding violation register, warning letter generator.
  11. `ai`: Ask AI Copilot (Gemini-powered conversational business intelligence).

### 3.3 Specialized Modal Modules (28 Modals)
1. `adminInventoryModal.js`: Depot and assistant stock issue/reconciliation modal.
2. `adminQuizModal.js`: Agronomy question authoring and cycle management modal.
3. `aqfsAuditModal.js`: Agricultural Quality Field Standard (AQFS) counter grading.
4. `assignedFormsListModal.js`: Field dynamic forms inbox.
5. `attendanceModal.js`: Punch in/out dialog with GPS capture and regularization appeal.
6. `competitorModal.js`: Competitor pricing, scheme, and inventory intelligence logger.
7. `demoPlotModal.js`: Demo plot trial registry with stage photos (Sowing, Vegetative, Harvest).
8. `dynamicFormBuilderModal.js`: Drag-and-drop form creator with multi-type fields.
9. `dynamicFormSubmissionsModal.js`: Review and export form responses from field.
10. `eodModal.js`: End-of-day summary submission dialog.
11. `farmerLeadsModal.js`: Direct farmer lead intake with land holding and crop details.
12. `farmerMeetingModal.js`: Kisan Sabha / Group farmer meeting registry.
13. `fillDynamicFormModal.js`: Field rep runtime dynamic form renderer.
14. `geminiAiChat.js`: Conversational AI modal with sales, inventory, and agronomy personas.
15. `kpiScoreModal.js`: Detailed breakdown of rep's 100-point score cards.
16. `leaveModal.js`: Leave application dialog with statutory balance checks (PL, CL, SL).
17. `mgoSuccessModal.js`: 10-step SOP guidelines and operating standards manual.
18. `modal.js`: Core reusable dialog wrapper.
19. `pinModal.js`: Manager security PIN authentication gatekeeper (`8888`).
20. `quizAuditModal.js`: Managerial quiz results inspector.
21. `quizModal.js`: Rep daily agronomy test runner with 45-second timer.
22. `receiptLightboxModal.js`: High-resolution receipt inspector for TA/DA claims.
23. `repStockLedgerModal.js`: Assistant inventory allocation view.
24. `repStockUpdateModal.js`: Counter stock liquidation recorder.
25. `smartTourBeatModal.js`: Interactive Leaflet map with TSP route solver and stop sequencing.
26. `speedAuditModal.js`: High-speed transit analyzer (>60 km/h) with warning notices.
27. `supabaseModal.js`: Cloud connection credentials manager, manual push/pull orchestrator.
28. `tadaPolicyModal.js`: Fuel rates (₹3.5/km) and allowance policy configuration.

---

## 4. MATHEMATICAL FORMULAS & BUSINESS RULES

### 4.1 MGO 100-Point KPI Scoring Algorithm (`src/services/kpiService.js`)
- **Total Points:** 100
  - **Dealer Reach & Visits (30 pts):** `(verifiedVisits / monthlyTarget) * 30`
  - **Tour Beat Execution (15 pts):** `(completedBeatStops / plannedBeatStops) * 15`
  - **Farmer Engagement / Sabha (15 pts):** `(farmerMeetings / targetMeetings) * 15`
  - **Product Demo Plots (10 pts):** `(demoPlots / targetDemos) * 10`
  - **Competitor Intel & Pricing (10 pts):** `(intelReports / targetIntel) * 10`
  - **Agronomy Knowledge Quiz (10 pts):** `(quizScore / maxQuizScore) * 10`
  - **EOD Reporting & Operational Discipline (10 pts):** `(timelyEodReports / workingDays) * 10`

### 4.2 TA/DA Travel Allowance Engine (`src/services/storage.js`)
- **Fuel Reimbursement:** `Approved Km * ₹3.50/km` (Bike rate configurable per policy).
- **Daily Allowance (DA) Rules:**
  - Full DA (₹250/day): Applicable when verified dealer visits $\ge 6$ stops/day.
  - Half DA (₹125/day): Applicable when visits between $3$ and $5$ stops/day.
  - Zero DA: Fewer than $3$ stops/day.
- **Outstation DA:** ₹400/day for overnight stay approved by manager.
- **Audit Flag Engine:** Automatically flags claims if `Claimed Km > GPS Verified Km * 1.25` (25% variance tolerance).

### 4.3 Geolocation & Route Optimization Engine (`src/utils/geo.js`)
- **Great-Circle Haversine Formula:** Real-time distance calculation between device GPS and counter coordinates.
- **Storefront Proximity Verification:** Visit is marked `Verified (GPS Validated)` if distance $\le 150$ meters from dealer geocenter.
- **TSP Route Solver:** 2-Opt heuristic Traveling Salesperson Problem solver that calculates minimum road journey from HQ through all scheduled counters and back.

### 4.4 Statutory Leave & Muster Rules (`src/services/storage.js`)
- **Leave Types:**
  - `PL`: Paid Leave (15 days/year, max 30 carry forward).
  - `CL`: Casual Leave (12 days/year, lapse on Dec 31).
  - `SL`: Sick Leave (10 days/year).
  - `LWP`: Leave Without Pay.
- **Muster Roll Codes:** `P` (Present), `HD` (Half Day), `OD` (On Duty), `WO` (Weekly Off - Sunday), `PL` (Paid Leave), `H` (Gazetted Holiday), `A` (Absent).

---

## 5. DATABASE SCHEMA INVENTORY (14 SUPABASE TABLES)

1. `retailers`: 1,146 counter records with geocoordinates, mobile, status, and potential.
2. `check_in_logs`: Real-time visit audit trail with lat/lng, distance error, map url, photo ID.
3. `assistants`: Field officer profiles, assigned HQs, block rosters, monthly targets.
4. `tour_plans`: Scheduled beat counter IDs per rep per date.
5. `farmer_meetings`: Kisan Sabha minutes, village, farmer attendance counts.
6. `demo_plots`: Crop trial stages, farmer contacts, GPS location.
7. `competitor_intel`: Competitor brands, wholesale rates, dealer margins, promotion schemes.
8. `farmer_leads`: Farmer pipeline with crop type, acreage, expected sowing date.
9. `aqfs_audits`: Agricultural Quality Field Standard scores (store branding, stock freshness).
10. `weekly_reviews`: Area manager supervisory assessment notes.
11. `quiz_questions`: Agronomy questions, multiple choice options, correct index.
12. `quiz_states`: Rep completion state, scores, answers.
13. `eod_reports`: Rep daily closing metrics, challenges, tomorrow's plan.
14. `leave_applications`: Leave requests, status (Pending, Approved, Rejected), balance deductions.
15. `attendance_records`: Punch in/out timestamps, GPS coordinates, regularization status.
16. `tada_claims`: Itemized travel claims, fuel calculations, receipts.

---

## 6. PROTOTYPE GAPS RELATIVE TO GROWTA MASTER PRD

| Area | Current Working Prototype | Growta Enterprise Target |
| :--- | :--- | :--- |
| **Multi-Tenancy** | Single organization (`tat_*`). | True multi-tenant isolation (`tenant_id`, RLS policies, multi-org hierarchies). |
| **API Architecture** | Direct client-to-Supabase PostgREST. | Modular Monolith Backend API Gateway with idempotent endpoints. |
| **Field Mobile** | Responsive web / PWA. | Native Flutter Shell with background geotracking and hardware camera stamps. |
| **Enterprise SKU/Stock** | Client-side ledger mock. | Multi-warehouse Depot Inventory Master with double-entry stock transactions. |
| **AI Intelligence** | Direct Gemini API client wrapper. | NeuronCore RAG architecture with crop domain embeddings and agent safety guards. |

---

## 7. RECOMMENDATION FOR STAGE 2

The prototype contains a complete, battle-tested domain model for agricultural sales operations. 
We recommend **zero breaking rewrites** to the current prototype. Instead, establish the backend modular architecture alongside it, progressively migrating modules per Section 102 of GROWTA-MASTER-PRD-001.
