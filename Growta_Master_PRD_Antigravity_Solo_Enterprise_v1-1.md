# GROWTA --- MASTER PRODUCT, SYSTEM DESIGN & ENGINEERING PRD

## Enterprise AI-Native Agricultural Business Operating System

### Antigravity Solo-Builder Edition --- Controlled, Phased, Module-by-Module Specification

**Document ID:** GROWTA-MASTER-PRD-001\
**Version:** 1.0\
**Status:** Master Build Specification\
**Build Model:** Solo founder + Antigravity AI agents\
**Primary requirement:** Build incrementally, verify every increment,
never invent unspecified behavior\
**Prototype baseline:** Existing AgriField Pro / Bihar Grid
field-operations prototype shown by the product owner\
**Product:** Growta\
**Parent:** Varyanta Global Industries

------------------------------------------------------------------------

# 0. HOW THIS DOCUMENT MUST BE USED

This document is not a prompt saying "build Growta."

It is the **controlled specification and operating contract** for
building Growta.

Antigravity MUST NOT attempt to build the whole platform in one task.

The implementation order is mandatory:

1.  Repository and engineering governance
2.  Prototype archaeology
3.  Technology baseline
4.  Design system
5.  Identity and tenancy foundation
6.  Core data model
7.  Backend platform foundation
8.  Flutter field shell
9.  Field Operations modules
10. Web administration shell
11. CRM
12. Orders and inventory
13. Workforce / TA-DA / leave
14. Demo / farmer / competitor intelligence
15. Analytics
16. AI foundation
17. NeuronCore
18. E2MIS
19. Commerce
20. Integrations
21. Advanced agents
22. Hardening, security, performance, release

**No later phase may be implemented by pretending earlier phases
exist.**

If a dependency is missing, the agent MUST STOP and report the
dependency.

If requirements are ambiguous, the agent MUST NOT invent a business
rule. It must create an `OPEN-QUESTION` item and continue only with
independently specified work.

------------------------------------------------------------------------

# 1. NON-HALLUCINATION CONTRACT

This section is mandatory for every Antigravity agent.

## 1.1 Source hierarchy

When deciding what Growta should do, use this order:

1.  Approved requirement in this PRD
2.  Approved domain PRD
3.  Approved Architecture Decision Record
4.  Existing production/prototype behavior explicitly accepted by the
    product owner
5.  Approved design specification
6.  Existing code behavior, only when it does not contradict approved
    requirements
7.  General engineering best practice

Never use assumptions above an explicit requirement.

## 1.2 Unknowns

When something is not specified:

-   Do not fabricate a value.
-   Do not silently choose a business rule.
-   Do not invent API behavior.
-   Do not invent pricing.
-   Do not invent legal/compliance requirements.
-   Do not invent user permissions.
-   Do not invent financial calculations.
-   Do not invent AI outputs.
-   Do not claim an integration exists.

Create:

`docs/open-questions/OQ-XXXX.md`

with:

-   Question
-   Why it matters
-   Options
-   Affected modules
-   Blocking/non-blocking status

## 1.3 Existing prototype

The current AgriField Pro prototype is the visual and functional
starting point for field operations.

Existing visible concepts include:

-   Field Officer login
-   Manager/Admin entry
-   Territory/HQ
-   Console
-   Counters
-   GPS Check-In
-   Book Order
-   Phone contact
-   Tour Beat
-   Smart Beat Journey Plan
-   Sequenced stops
-   Farmer CRM
-   TA/DA
-   Leave
-   Stock & Liquidation
-   Sabha
-   Demo
-   Intel/Pricing
-   MGO 100-point KPI
-   10-step Daily Operating Rhythm/SOP
-   GPS storefront audit
-   Visit remarks
-   Shift protocol
-   Punch in/out
-   Mileage
-   Target/achievement
-   Retailer/counter status

These are to be **productized**, not discarded.

------------------------------------------------------------------------

# 2. PRODUCT VISION

Growta is an AI-native agricultural business operating system.

It combines:

-   CRM
-   Field Force Automation
-   Sales Force Automation
-   Retailer/Distributor Management
-   Farmer CRM
-   Inventory
-   Order Management
-   Workforce Management
-   Route/Beat Planning
-   Demo Management
-   Competitor Intelligence
-   KPI/SOP Management
-   BI
-   AI
-   Forecasting
-   Workflow Automation
-   Commerce
-   Integrations

The fundamental lifecycle is:

**Record → Understand → Predict → Recommend → Execute → Measure →
Learn**

------------------------------------------------------------------------

# 3. PLATFORM PRINCIPLE

Growta has four primary responsibility layers.

## 3.1 Flutter

Flutter is the **field execution layer**.

Primary use cases:

-   GPS
-   Visits
-   Field attendance
-   Offline work
-   Camera
-   Voice
-   Farmer interaction
-   Retailer interaction
-   Route execution
-   Orders
-   Field stock observation
-   TA/DA capture
-   Demo capture
-   Competitor intelligence

## 3.2 Web

Web is the **enterprise control layer**.

Primary use cases:

-   Administration
-   CRM administration
-   Product/SKU management
-   Inventory administration
-   User/role management
-   Territory management
-   KPI/SOP configuration
-   BI
-   AI administration
-   Audit
-   Security
-   Integrations
-   Super Admin

## 3.3 Backend

Backend is the **system of record**.

It owns:

-   Identity
-   Tenant isolation
-   Authorization
-   Business rules
-   Transactions
-   Database
-   Events
-   Audit
-   Integration state

## 3.4 NeuronCore

NeuronCore is the **intelligence layer**.

It owns:

-   Context
-   Retrieval
-   AI reasoning
-   Prediction
-   Recommendation
-   Agent orchestration
-   AI evaluation
-   Model routing
-   AI governance

------------------------------------------------------------------------

# 4. PLATFORM SURFACE MATRIX

  Capability                 Flutter           Web    Backend               AI
  ------------------- -------------- ------------- ---------- ----------------
  Field Console              PRIMARY      Optional   REQUIRED         Optional
  GPS Check-In               PRIMARY          View   REQUIRED         Optional
  Visit Evidence             PRIMARY          View   REQUIRED         Optional
  Beat Execution             PRIMARY     Configure   REQUIRED           Future
  Route Planning             PRIMARY       PRIMARY   REQUIRED           Future
  Retailer CRM               PRIMARY       PRIMARY   REQUIRED           Future
  Farmer CRM                 PRIMARY       PRIMARY   REQUIRED   PRIMARY/Future
  Orders                     PRIMARY       PRIMARY   REQUIRED         Optional
  Inventory               Field view       PRIMARY   REQUIRED   PRIMARY/Future
  Product Master                  No       PRIMARY   REQUIRED         Optional
  Workforce                  PRIMARY       PRIMARY   REQUIRED         Optional
  TA/DA                      PRIMARY       PRIMARY   REQUIRED         Optional
  Leave                      PRIMARY       PRIMARY   REQUIRED         Optional
  Demo                       PRIMARY       PRIMARY   REQUIRED   PRIMARY/Future
  Competitor Intel           PRIMARY       PRIMARY   REQUIRED   PRIMARY/Future
  KPI/SOP                    Execute     Configure   REQUIRED         Optional
  BI                    View/limited       PRIMARY   REQUIRED          PRIMARY
  Super Admin                     No       PRIMARY   REQUIRED               No
  AI Administration               No       PRIMARY   REQUIRED          PRIMARY
  E2MIS                           No       PRIMARY   REQUIRED          PRIMARY
  Commerce                   PRIMARY   PRIMARY/PWA   REQUIRED         Optional

------------------------------------------------------------------------

# 5. ARCHITECTURE PRINCIPLE: MODULAR MONOLITH FIRST

Growta MUST NOT begin as dozens of microservices.

Initial architecture:

-   Modular backend
-   Strong domain boundaries
-   Shared infrastructure
-   Separate worker processes where useful
-   Separate AI service where useful
-   Separate analytics workload where useful

Services are extracted only when justified by:

-   Scale
-   Security boundary
-   Reliability
-   Deployment independence
-   Workload isolation

------------------------------------------------------------------------

# 6. TARGET TECHNOLOGY BASELINE

Exact versions MUST be pinned after prototype archaeology.

The project must maintain:

`docs/engineering/TECHNOLOGY-BASELINE.md`

It must record:

-   Flutter version
-   Dart version
-   Android SDK
-   Minimum Android version
-   iOS version if iOS is enabled
-   Web framework version
-   Node.js version
-   Python version
-   PostgreSQL version
-   Redis version
-   ORM
-   Testing frameworks
-   AI SDKs
-   Maps SDK
-   Push notification SDK
-   Payment SDKs
-   CI/CD tooling

### Version rule

Agents MUST NOT upgrade dependencies casually.

A version upgrade requires:

1.  Reason
2.  Compatibility analysis
3.  Security reason if applicable
4.  Test run
5.  Changelog
6.  Approval for major upgrades

------------------------------------------------------------------------

# 7. REPOSITORY STANDARD

Recommended root:

``` text
growta/
├── AGENTS.md
├── README.md
├── CHANGELOG.md
├── LICENSE
├── .gitignore
├── .env.example
│
├── docs/
│   ├── product/
│   ├── architecture/
│   ├── adr/
│   ├── api/
│   ├── database/
│   ├── security/
│   ├── ai/
│   ├── ux/
│   ├── operations/
│   ├── runbooks/
│   ├── releases/
│   └── open-questions/
│
├── apps/
│   ├── field_app/
│   ├── web_admin/
│   └── web_portal/
│
├── services/
│   ├── api/
│   ├── worker/
│   ├── ai/
│   └── integrations/
│
├── packages/
│   ├── design_system/
│   ├── shared_types/
│   ├── validation/
│   ├── auth/
│   ├── telemetry/
│   └── config/
│
├── database/
│   ├── schema/
│   ├── migrations/
│   ├── seeds/
│   └── fixtures/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── security/
│   ├── performance/
│   └── ai-evals/
│
├── infrastructure/
│   ├── development/
│   ├── staging/
│   └── production/
│
├── scripts/
└── .github/
    └── workflows/
```

------------------------------------------------------------------------

# 8. ENGINEERING GOVERNANCE

## 8.1 AGENTS.md

The root `AGENTS.md` must state:

-   Architecture rules
-   Security rules
-   Database rules
-   API rules
-   Testing rules
-   UI rules
-   AI rules
-   Dependency rules
-   Git rules
-   Deployment rules
-   Non-hallucination rules

## 8.2 Agent Skills

Create reusable skills:

``` text
feature-development
bug-fix
architecture-review
database-change
api-development
flutter-development
web-development
design-system
security-review
test-generation
e2e-testing
ai-feature
rag-feature
ai-evaluation
documentation
release
incident-response
performance-review
dependency-upgrade
prototype-migration
```

------------------------------------------------------------------------

# 9. CHANGE CONTROL

Every non-trivial feature follows:

``` text
Requirement
→ Impact analysis
→ Architecture check
→ Implementation plan
→ Human approval
→ Code
→ Test
→ Security check
→ E2E
→ Documentation
→ Verification artifact
→ Human approval
→ Staging
→ Production
```

------------------------------------------------------------------------

# 10. REQUIREMENT ID SYSTEM

Every requirement gets an immutable ID.

Examples:

``` text
AUTH-001
TENANT-001
CRM-001
VISIT-001
GPS-001
ROUTE-001
ORDER-001
INV-001
FARM-001
DEMO-001
COMP-001
KPI-001
SOP-001
AI-001
RAG-001
E2MIS-001
```

------------------------------------------------------------------------

# 11. DEFINITION OF READY

A feature is Ready only if:

-   Requirement is clear
-   User is identified
-   Business outcome is known
-   Acceptance criteria exist
-   Data entities identified
-   Permissions identified
-   Platform identified
-   Dependencies identified
-   Failure states identified
-   Test strategy identified

------------------------------------------------------------------------

# 12. DEFINITION OF DONE

A feature is Done only when:

-   Implementation complete
-   Type checking passes
-   Lint passes
-   Unit tests pass
-   Integration tests pass where applicable
-   E2E tests pass where applicable
-   Security review passes
-   Error handling exists
-   Audit behavior exists
-   Loading/empty/error states exist
-   Documentation updated
-   Acceptance criteria verified
-   No unexplained TODOs
-   No secrets
-   No debug bypasses
-   Verification artifact produced

------------------------------------------------------------------------

# 13. DESIGN SYSTEM

Before building dozens of screens, establish the Growta Design System.

## Design tokens

-   Color
-   Typography
-   Spacing
-   Radius
-   Shadows
-   Elevation
-   Motion
-   Iconography
-   Breakpoints
-   Accessibility contrast

## Components

-   App shell
-   Bottom navigation
-   Top bar
-   Cards
-   KPI cards
-   Data tables
-   Forms
-   Buttons
-   Dialogs
-   Bottom sheets
-   Drawers
-   Tabs
-   Chips
-   Badges
-   Maps
-   Timeline
-   Camera capture
-   AI panel
-   Approval panel
-   Audit viewer
-   Empty state
-   Error state
-   Skeleton loading
-   Toast/snackbar

------------------------------------------------------------------------

# 14. VISUAL LANGUAGE FROM PROTOTYPE

The existing prototype uses a dark, field-operations-oriented interface.

The product team may preserve the visual direction, but must convert it
into a formal design system.

Do not copy arbitrary colors screen by screen.

Create semantic tokens:

``` text
primary
secondary
success
warning
danger
info
surface
background
text
muted
border
```

The field app must remain highly legible outdoors and on low-quality
screens.

------------------------------------------------------------------------

# 15. ACCESSIBILITY

Minimum requirements:

-   Readable text
-   Adequate contrast
-   Large touch targets
-   Screen reader labels where applicable
-   No information conveyed only by color
-   Clear focus states
-   Error messages tied to fields
-   Accessible icons

------------------------------------------------------------------------

# 16. CORE DOMAIN MODEL

Primary entities:

``` text
Tenant
Organization
BusinessUnit
Region
Zone
Territory
HQ
Employee
User
Role
Permission

Distributor
Retailer/Counter
Farmer
Lead

Crop
Variety
Product
SKU
Batch
Warehouse
Inventory

Visit
VisitEvidence
VisitOutcome
FollowUp
Task

Beat
Route
RouteStop

Order
OrderLine
Payment
Invoice
Return

DemoPlot
DemoObservation
DemoOutcome

Competitor
CompetitorProduct
CompetitorObservation

KPI
KPIResult
SOP
SOPStep
SOPExecution

Attendance
Shift
Leave
TAClaim
Mileage

Scheme
Reward
RewardTransaction

Alert
Recommendation
Forecast
Anomaly

Document
KnowledgeSource
AIConversation
AIAssessment
AIAgentRun
AIAction

Workflow
WorkflowExecution

AuditLog
Integration
Webhook
```

------------------------------------------------------------------------

# 17. TENANCY

Every tenant-owned record must be tenant-scoped.

Required pattern:

``` text
tenant_id
```

Tenant isolation must be enforced in backend authorization/data access.

Frontend filtering is never considered sufficient.

------------------------------------------------------------------------

# 18. IDENTITY

Production identity must be server-controlled.

The prototype's demo password such as `rep123` MUST NOT survive into
production.

Support architecture for:

-   Email
-   Phone
-   Password
-   OTP
-   MFA
-   SSO later

User identity determines:

-   Tenant
-   Organization
-   Role
-   Permissions
-   Territory
-   Profile

Users do not gain privileges by selecting a profile on the client.

------------------------------------------------------------------------

# 19. AUTHORIZATION

Use:

-   RBAC
-   Tenant scoping
-   Organization scoping
-   Territory scoping
-   Record-level checks where needed
-   Action-level permissions

Permission examples:

``` text
retailer.read
retailer.create
retailer.update
retailer.export

visit.create
visit.submit
visit.review

order.create
order.approve
order.cancel

inventory.read
inventory.adjust

kpi.configure
sop.configure
```

------------------------------------------------------------------------

# 20. MODULE 1 --- FIELD COMMAND CENTER

**Platform:** Flutter primary.

Purpose:

Provide the field employee with one operational home screen.

## Data shown

-   Employee
-   Territory
-   HQ
-   Shift
-   Attendance status
-   GPS status
-   Today's target
-   Achievement
-   Orders
-   Leads
-   Mileage
-   Priority actions
-   Planned visits
-   SOP progress

## Primary actions

-   Start shift
-   GPS check-in
-   Open counter
-   Book order
-   Call retailer
-   Open beat
-   Farmer CRM
-   Demo
-   Competitor intelligence
-   TA/DA
-   Leave
-   EOD

## Acceptance

Opening the app must allow the user to understand today's work without
navigating through multiple administrative screens.

------------------------------------------------------------------------

# 21. MODULE 2 --- ATTENDANCE & SHIFT

**Platform:** Flutter execution + Web administration.

Entities:

``` text
Shift
Attendance
Punch
GPSObservation
```

Features:

-   Shift schedule
-   Punch in
-   Punch out
-   GPS capture
-   Shift status
-   Late/early status
-   Attendance history
-   Manager review

Do not hard-code a specific shift such as 09:30--18:30 into the product.

It must be tenant-configurable.

------------------------------------------------------------------------

# 22. MODULE 3 --- GPS LOCATION SERVICE

**Platform:** Flutter + Backend.

Capture:

-   Latitude
-   Longitude
-   Accuracy
-   Timestamp
-   Device information where allowed
-   Visit ID
-   User ID
-   Retailer ID when applicable

Never claim GPS precision that the device did not provide.

------------------------------------------------------------------------

# 23. MODULE 4 --- RETAILER / COUNTER CRM

**Platform:** Flutter + Web.

Retailer profile:

-   Legal/display name
-   Contact
-   Address
-   Coordinates
-   Territory
-   Distributor
-   Categories
-   Crops
-   Status
-   Visit history
-   Order history
-   Outstanding where applicable
-   Inventory observations
-   Competitor observations
-   Demo relationships

------------------------------------------------------------------------

# 24. MODULE 5 --- GPS CHECK-IN

Flow:

``` text
Open retailer
→ Request location
→ Obtain current location
→ Validate accuracy
→ Calculate distance
→ Determine visit state
→ Show evidence requirements
→ Capture evidence
→ Remarks
→ Submit
→ Server validation
→ Visit created
```

Possible statuses:

``` text
ON_SITE
NEAR_SITE
REMOTE
PHONE_VISIT
GPS_UNAVAILABLE
REVIEW_REQUIRED
```

No status should automatically imply misconduct.

------------------------------------------------------------------------

# 25. MODULE 6 --- VISIT INTEGRITY

Inputs:

-   Distance
-   Accuracy
-   Timestamp
-   Route
-   Previous visit
-   Next visit
-   Evidence metadata
-   Device state where legally/technically appropriate

Output:

``` text
integrity_status
integrity_score
review_reason
```

The score must not be described as proof of fraud.

------------------------------------------------------------------------

# 26. MODULE 7 --- STORE / FIELD EVIDENCE

Capture:

-   Storefront
-   Shelf
-   Product
-   Competitor
-   Demo
-   Document/invoice if permitted

Metadata:

-   Visit
-   User
-   Retailer
-   Timestamp
-   GPS
-   File hash
-   Upload state

Prototype simulation capture must be replaced with real device capture
in production.

------------------------------------------------------------------------

# 27. MODULE 8 --- VISIT REMARKS

Support:

-   Text
-   Voice note later
-   Structured outcomes
-   Follow-up date
-   Next action

AI may summarize the remark but the original must remain available.

------------------------------------------------------------------------

# 28. MODULE 9 --- BEAT MANAGEMENT

Beat:

A reusable field coverage plan.

Contains:

-   Territory
-   Customers
-   Frequency
-   Preferred day
-   Priority
-   Route

------------------------------------------------------------------------

# 29. MODULE 10 --- SMART JOURNEY PLAN

Start deterministic.

Inputs:

-   Starting point
-   Destination/HQ
-   Eligible retailers
-   Priority
-   Visit requirement
-   Time window
-   Travel distance

Outputs:

-   Ordered stops
-   Distance
-   Estimated travel time
-   Completion
-   Remaining stops

Later AI may optimize priority, but deterministic route behavior must
remain available.

------------------------------------------------------------------------

# 30. MODULE 11 --- LIVE ROUTE EXECUTION

Flutter:

-   Current stop
-   Next stop
-   Navigation action
-   Check-in
-   Skip
-   Call
-   Order
-   Completion

Web:

-   Live team overview where enabled
-   Route compliance
-   Coverage

------------------------------------------------------------------------

# 31. MODULE 12 --- ORDER BOOKING

Flutter:

-   Select retailer
-   Select SKU
-   Quantity
-   Price/price list
-   Scheme
-   Discount if authorized
-   Review
-   Submit

Backend:

-   Validate
-   Calculate
-   Reserve if configured
-   Create order
-   Audit

Web:

-   Review
-   Approve
-   Fulfil
-   Cancel according to permission

------------------------------------------------------------------------

# 32. MODULE 13 --- PRODUCT & SKU MASTER

Web primary.

Fields:

-   Product
-   Brand
-   Crop
-   Variety
-   Category
-   SKU
-   Pack size
-   Unit
-   Price
-   Tax configuration where applicable
-   Active/inactive
-   Batch linkage

Never embed product master data inside Flutter code.

------------------------------------------------------------------------

# 33. MODULE 14 --- INVENTORY

Entities:

``` text
Warehouse
Stock
Batch
StockMovement
StockReservation
StockTransfer
Adjustment
```

Support:

-   Opening stock
-   Receipt
-   Issue
-   Transfer
-   Adjustment
-   Reservation
-   Return
-   Expiry

All stock changes must be auditable.

------------------------------------------------------------------------

# 34. MODULE 15 --- STOCK & LIQUIDATION

Existing prototype concept becomes a formal inventory intelligence
module.

Display:

-   Slow moving
-   Near expiry
-   Overstock
-   Understock
-   Territory imbalance

Actions:

-   Transfer
-   Allocate
-   Liquidate according to configured policy
-   Create task

AI recommendations are advisory until explicitly approved.

------------------------------------------------------------------------

# 35. MODULE 16 --- FARMER CRM

Flutter primary.

Profile:

-   Farmer
-   Location
-   Crops
-   Area
-   Irrigation
-   Crop stage
-   Variety
-   Problems
-   Visits
-   Demos
-   Purchases where available
-   Follow-up

------------------------------------------------------------------------

# 36. MODULE 17 --- DEMO PLOT

Entities:

``` text
DemoPlot
DemoTreatment
DemoObservation
DemoEvidence
DemoOutcome
```

Track:

-   Farmer
-   Crop
-   Variety
-   Competitor
-   Area
-   Sowing
-   Observations
-   Photos
-   Harvest
-   Result
-   Feedback

------------------------------------------------------------------------

# 37. MODULE 18 --- SABHA / MEETING

Configurable engagement module.

Capture:

-   Event
-   Date
-   Location
-   Participants
-   Purpose
-   Topics
-   Products
-   Photos
-   Outcomes
-   Follow-ups

------------------------------------------------------------------------

# 38. MODULE 19 --- COMPETITOR INTELLIGENCE

Existing "Intel / Pricing" concept becomes:

**Competitor Intelligence Engine**

Capture:

-   Competitor
-   Product
-   SKU
-   Pack
-   Price
-   Availability
-   Scheme
-   Stock observation
-   Farmer preference
-   Location
-   Evidence

Web aggregates the information.

AI later identifies trends.

------------------------------------------------------------------------

# 39. MODULE 20 --- TA/DA

Flutter:

-   Mileage
-   Expense
-   Receipt
-   Travel details
-   Claim draft

Web:

-   Policy
-   Review
-   Approval
-   Rejection
-   Finance export

Calculations must come from configurable policy, not hard-coded values.

------------------------------------------------------------------------

# 40. MODULE 21 --- LEAVE

Flutter:

-   Balance
-   Apply
-   Status

Web:

-   Leave policy
-   Approval
-   Balance adjustment
-   Audit

Do not hard-code "35 days" from the prototype.

------------------------------------------------------------------------

# 41. MODULE 22 --- KPI ENGINE

Replace hard-coded MGO score with a generic engine.

KPI:

``` text
name
description
weight
target
measurement
period
eligibility
evidence_requirement
approval_requirement
```

Score calculations must be explicit and testable.

------------------------------------------------------------------------

# 42. MODULE 23 --- SOP ENGINE

Existing 10-step Daily Operating Rhythm becomes configurable.

Entities:

``` text
SOP
SOPStep
SOPAssignment
SOPExecution
SOPEvidence
```

Each step may require:

-   Action
-   Evidence
-   Location
-   Time
-   Approval

------------------------------------------------------------------------

# 43. MODULE 24 --- EOD CLOSURE

Field employee should be able to close the day.

System verifies configurable requirements:

-   Attendance
-   Planned visits
-   Orders
-   Follow-ups
-   Expenses
-   Evidence
-   SOP steps

Missing requirements are shown clearly.

Do not invent whether missing requirements block EOD; make it
configurable.

------------------------------------------------------------------------

# 44. MODULE 25 --- MANAGER WEB CONSOLE

Web-first.

Navigation:

``` text
Dashboard
People
Territories
Counters
Farmers
Sales
Orders
Inventory
Demos
Competitors
KPI
SOP
TA/DA
Leave
Reports
AI
Audit
Settings
```

------------------------------------------------------------------------

# 45. MODULE 26 --- SUPER ADMIN

Manage:

-   Tenants
-   Plans
-   Feature flags
-   Global modules
-   System health
-   AI models
-   Integrations
-   Security policies
-   Audit
-   Usage

------------------------------------------------------------------------

# 46. MODULE 27 --- BI

Web primary.

Dashboards:

-   Sales
-   Coverage
-   Retailer activation
-   Inventory
-   Field productivity
-   Orders
-   Collections where supported
-   Demo
-   Competitor intelligence
-   Workforce

------------------------------------------------------------------------

# 47. MODULE 28 --- NATURAL LANGUAGE ANALYTICS

User asks:

"Which retailers in my territory have not ordered in 30 days?"

System:

1.  Authenticate
2.  Determine tenant
3.  Determine scope
4.  Parse request
5.  Generate structured query
6.  Validate query
7.  Execute
8.  Return result
9.  Explain source fields

AI must never bypass authorization.

------------------------------------------------------------------------

# 48. MODULE 29 --- NEURONCORE

NeuronCore is not a chatbot.

Architecture:

``` text
Business data
Knowledge
Events
External data
       ↓
Context Engine
       ↓
NeuronCore
       ↓
Reasoning / prediction / recommendation
       ↓
Action proposal
       ↓
Human/system approval
       ↓
Outcome
```

------------------------------------------------------------------------

# 49. MODULE 30 --- AI GATEWAY

All model calls go through one abstraction.

Business modules must not directly depend on a specific AI vendor.

Support:

-   Model routing
-   Cost tracking
-   Prompt versions
-   Model versions
-   Fallback
-   Timeouts
-   Evaluation
-   Logging without exposing sensitive content unnecessarily

------------------------------------------------------------------------

# 50. MODULE 31 --- RAG

Knowledge sources:

-   Product manuals
-   SOPs
-   Internal policies
-   Training documents
-   Agronomy documents
-   Technical documents

Each source needs:

-   Owner
-   Version
-   Access policy
-   Timestamp
-   Source ID

Retrieval must be permission-aware.

------------------------------------------------------------------------

# 51. MODULE 32 --- AI SALES ANALYST

Initial capabilities:

-   Explain sales changes
-   Identify top/bottom movement
-   Summarize territory
-   Highlight anomalies
-   Suggest questions for follow-up

AI must distinguish facts from inference.

------------------------------------------------------------------------

# 52. MODULE 33 --- AI INVENTORY ANALYST

Initial capabilities:

-   Stock coverage
-   Stock-out risk
-   Slow-moving stock
-   Expiry exposure
-   Territory imbalance

Forecasting must expose uncertainty.

------------------------------------------------------------------------

# 53. MODULE 34 --- AI FIELD ASSISTANT

Flutter contextual assistant:

-   Summarize retailer
-   Show last order
-   Show previous visit
-   Show open follow-up
-   Prepare visit agenda
-   Summarize after visit

It must not invent retailer history.

------------------------------------------------------------------------

# 54. MODULE 35 --- AI AGENTS

Agent permission levels:

``` text
L0 Read
L1 Recommend
L2 Draft
L3 Execute
```

Default for new agents:

**L1 Recommend**

Financial, master-data and destructive actions require explicit
authorization.

------------------------------------------------------------------------

# 55. MODULE 36 --- E2MIS

Excel-to-Module Intelligence System.

Flow:

``` text
Upload
→ Inspect
→ Detect schema
→ Identify entities
→ Suggest mapping
→ Human review
→ Validate
→ Import
→ Reconcile
```

It must never silently create production modules from an Excel file.

------------------------------------------------------------------------

# 56. MODULE 37 --- OUTCOME VAULT

Store:

``` text
Recommendation
Action
Decision
Outcome
Result
ROI/impact where measurable
```

This becomes the foundation for recommendation evaluation.

------------------------------------------------------------------------

# 57. MODULE 38 --- WORKFLOW ENGINE

Generic:

``` text
Trigger
→ Condition
→ Action
→ Approval
→ Notification
→ Escalation
```

Workflows must be versioned.

Existing executions continue against their original version.

------------------------------------------------------------------------

# 58. MODULE 39 --- NOTIFICATION ENGINE

Channels:

-   In-app
-   Push
-   Email
-   SMS
-   WhatsApp through approved provider

Notifications must support:

-   Priority
-   Deduplication
-   User preferences
-   Retry
-   Delivery status

------------------------------------------------------------------------

# 59. MODULE 40 --- AUDIT

Audit sensitive actions:

-   Login
-   Permission changes
-   Role changes
-   Customer changes
-   Product changes
-   Price changes
-   Inventory adjustments
-   Order approval
-   AI actions
-   Exports
-   Data deletion

------------------------------------------------------------------------

# 60. MODULE 41 --- SEARCH

Global search across authorized entities.

Phase 1:

-   Exact/prefix search

Phase 2:

-   Filters

Phase 3:

-   Semantic search

------------------------------------------------------------------------

# 61. MODULE 42 --- COMMERCE

Later phase.

Capabilities:

-   Catalog
-   Cart
-   Checkout
-   Payment
-   Order
-   Shipment
-   Tracking
-   Returns

Use PWA/Web plus Flutter where mobile experience provides value.

------------------------------------------------------------------------

# 62. MODULE 43 --- INTEGRATIONS

Integration abstraction must support:

-   Payments
-   Logistics
-   Maps
-   Messaging
-   Weather
-   Market data
-   Accounting
-   ERP

Every integration must have:

-   Credentials
-   Configuration
-   Health
-   Webhooks
-   Retry
-   Idempotency
-   Audit

------------------------------------------------------------------------

# 63. OFFLINE-FIRST REQUIREMENT

Field app must work during poor connectivity.

Local:

-   Visit drafts
-   Evidence metadata
-   Orders
-   Notes
-   Farmer records
-   Retailer records required for assigned territory
-   Route

Sync:

``` text
Local event
→ Queue
→ Upload
→ Server validation
→ Acknowledgement
→ Local state update
```

------------------------------------------------------------------------

# 64. CONFLICT RESOLUTION

Records require:

-   UUID
-   version
-   created_at
-   updated_at
-   device_id where useful
-   sync_state

Conflicts must follow domain-specific rules.

Never use blind last-write-wins for critical financial/inventory records
without explicit design.

------------------------------------------------------------------------

# 65. SECURITY

Mandatory:

-   HTTPS
-   Secure authentication
-   Password hashing
-   Token expiry
-   Token rotation where applicable
-   Tenant isolation
-   RBAC
-   Audit
-   Rate limiting
-   Input validation
-   Output encoding
-   Secure file handling
-   Secret management
-   Dependency scanning

------------------------------------------------------------------------

# 66. FILE SECURITY

For uploads:

-   Size limit
-   MIME validation
-   Extension validation
-   Secure object storage
-   Authorization
-   Signed access
-   Retention
-   Malware scanning where available

------------------------------------------------------------------------

# 67. DATABASE RULES

Never modify schema manually in production.

Every change requires:

``` text
Migration
→ Test
→ Rollback plan
→ Review
→ Deployment
```

All foreign keys and important business invariants must be explicit.

------------------------------------------------------------------------

# 68. API RULES

Every API must specify:

-   Method
-   Path
-   Authentication
-   Authorization
-   Request schema
-   Response schema
-   Error codes
-   Validation
-   Idempotency
-   Audit requirement

Maintain OpenAPI.

------------------------------------------------------------------------

# 69. OBSERVABILITY

Track:

-   Request ID
-   Error
-   Latency
-   Database latency
-   Queue state
-   AI latency
-   AI cost
-   Sync failures
-   Mobile crashes
-   Integration failures

------------------------------------------------------------------------

# 70. TESTING

Required layers:

``` text
Static analysis
Unit
Integration
API contract
E2E
Security
Performance
AI evaluation
```

Every bug that reaches a release should produce a regression test where
practical.

------------------------------------------------------------------------

# 71. AI TESTING

Every AI feature needs:

-   Evaluation dataset
-   Expected facts
-   Forbidden behavior
-   Grounding tests
-   Authorization tests
-   Regression tests
-   Cost tests
-   Latency tests

Never declare an AI feature production-ready because one demonstration
worked.

------------------------------------------------------------------------

# 72. PERFORMANCE

Initial engineering targets are design targets, not promises.

Measure:

-   API latency
-   Database query time
-   Flutter startup
-   Screen rendering
-   Sync throughput
-   Image upload
-   AI latency

Optimize based on actual measurements.

------------------------------------------------------------------------

# 73. RELEASE STRATEGY

``` text
Local
→ Development
→ Staging
→ Production
```

Production deployment must require:

-   Passing CI
-   Migration verification
-   Smoke tests
-   Monitoring
-   Founder approval

------------------------------------------------------------------------

# 74. FEATURE FLAGS

Use flags for:

-   Experimental AI
-   New UI
-   New route engine
-   New scoring
-   New workflows

Rollout:

``` textinternal
→ Pilot tenant
→ Small percentage
→ General availability
```

------------------------------------------------------------------------

# 75. BACKUP & RECOVERY

Document:

-   Backup frequency
-   Retention
-   Restore procedure
-   RPO
-   RTO
-   Disaster recovery
-   Rollback

These values must be selected based on actual infrastructure and
business requirements; do not invent them in code.

------------------------------------------------------------------------

# 76. INCIDENT RESPONSE

Runbooks required:

``` text
API outage
Database outage
Authentication outage
AI outage
Payment failure
Storage failure
Sync failure
Security incident
Bad deployment
Data corruption
```

------------------------------------------------------------------------

# 77. PROTOTYPE MIGRATION

Before implementing new features, Antigravity must produce:

`docs/prototype/PROTOTYPE-AUDIT.md`

For every existing screen:

``` text
Screen
Current behavior
Current technology
Reusable components
Business logic
Data dependencies
Hard-coded values
Mock data
Security issues
Target module
Target platform
KEEP / REFACTOR / REBUILD / DEPRECATE
Migration notes
```

No prototype code should be deleted before this inventory is complete.

------------------------------------------------------------------------

# 78. PROTOTYPE SCREEN MAP

## Login/Profile

Target:

**Identity + Workforce**

Platform:

Flutter

Production changes:

-   Remove demo password
-   Server identity
-   Tenant resolution
-   Role resolution
-   Secure session

------------------------------------------------------------------------

## Console

Target:

**Field Command Center**

Platform:

Flutter

Keep:

-   Territory
-   Shift
-   Target
-   Orders
-   Leads
-   Mileage
-   Field operations

Refactor:

-   Hard-coded metrics
-   Demo values
-   Fake GPS
-   Simulated evidence

------------------------------------------------------------------------

## Counters

Target:

**Retailer CRM**

Platform:

Flutter + Web

------------------------------------------------------------------------

## GPS Check-In

Target:

**Visit + Visit Integrity**

Platform:

Flutter + Backend

------------------------------------------------------------------------

## Smart Beat

Target:

**Beat + Route Management**

Platform:

Flutter + Web

------------------------------------------------------------------------

## Farmer CRM

Target:

**Farmer & Crop CRM**

Platform:

Flutter + Web

------------------------------------------------------------------------

## TA/DA

Target:

**Expense & Mobility**

Platform:

Flutter + Web

------------------------------------------------------------------------

## Stock & Liquidation

Target:

**Inventory Intelligence**

Platform:

Flutter + Web

------------------------------------------------------------------------

## MGO

Target:

**KPI Engine**

Platform:

Flutter + Web

------------------------------------------------------------------------

## Daily SOP

Target:

**Workflow/SOP Engine**

Platform:

Flutter + Web

------------------------------------------------------------------------

# 79. DEVELOPMENT PHASES

## PHASE 0 --- GOVERNANCE

Build:

-   Repository
-   AGENTS.md
-   Skills
-   Rules
-   Documentation structure
-   CI skeleton
-   Technology baseline
-   ADR templates

**Exit:** Governance passes review.

------------------------------------------------------------------------

## PHASE 1 --- PROTOTYPE ARCHAEOLOGY

Build:

-   Screen inventory
-   Code inventory
-   dependency inventory
-   data inventory
-   risk inventory
-   migration matrix

**Exit:** Every prototype capability is classified.

------------------------------------------------------------------------

## PHASE 2 --- DESIGN SYSTEM

Build:

-   Tokens
-   Typography
-   Components
-   Flutter theme
-   Web theme
-   Responsive patterns
-   Accessibility

**Exit:** New screens can be assembled from approved components.

------------------------------------------------------------------------

## PHASE 3 --- PLATFORM FOUNDATION

Build:

-   Backend
-   Database
-   migrations
-   configuration
-   logging
-   telemetry
-   API conventions
-   error handling

**Exit:** Empty enterprise application can run safely.

------------------------------------------------------------------------

## PHASE 4 --- IDENTITY & TENANCY

Build:

-   Login
-   User
-   Tenant
-   Organization
-   Roles
-   Permissions
-   Sessions
-   Audit

**Exit:** Secure multi-tenant foundation.

------------------------------------------------------------------------

## PHASE 5 --- FIELD APP SHELL

Build:

-   Flutter navigation
-   Authentication
-   Home
-   profile
-   offline database
-   sync engine
-   location service
-   camera service
-   notifications

**Exit:** Field app foundation works offline and online.

------------------------------------------------------------------------

## PHASE 6 --- FIELD OPERATIONS

Build sequentially:

1.  Attendance
2.  GPS
3.  Counter CRM
4.  Visit
5.  Evidence
6.  Order
7.  Beat
8.  Route execution
9.  Farmer CRM
10. Demo
11. Competitor Intel
12. TA/DA
13. Leave
14. SOP
15. EOD

Each module gets its own acceptance tests.

------------------------------------------------------------------------

## PHASE 7 --- WEB CONTROL PLANE

Build:

-   Admin
-   Employees
-   Territories
-   Counters
-   Products
-   Orders
-   Inventory
-   KPI
-   SOP
-   Reports
-   Audit

------------------------------------------------------------------------

## PHASE 8 --- SALES & INVENTORY

Build:

-   Product master
-   SKU
-   Pricing
-   Orders
-   Inventory
-   Batches
-   Transfers
-   Liquidation
-   Schemes

------------------------------------------------------------------------

## PHASE 9 --- ANALYTICS

Build:

-   Data model
-   Aggregations
-   dashboards
-   filters
-   exports
-   role-based analytics

------------------------------------------------------------------------

## PHASE 10 --- AI FOUNDATION

Build:

-   AI gateway
-   model abstraction
-   prompt registry
-   AI logging
-   RAG
-   evaluation framework
-   cost controls

------------------------------------------------------------------------

## PHASE 11 --- NEURONCORE

Build:

1.  Context engine
2.  Sales analyst
3.  Inventory analyst
4.  Field assistant
5.  Recommendation engine
6.  Forecasting
7.  Anomaly detection
8.  Agent framework

------------------------------------------------------------------------

## PHASE 12 --- E2MIS

Build:

-   XLSX ingestion
-   schema detection
-   entity detection
-   mapping
-   validation
-   import
-   reconciliation
-   module proposal

------------------------------------------------------------------------

## PHASE 13 --- COMMERCE

Build:

-   Catalog
-   PWA
-   Cart
-   Checkout
-   Payments
-   Logistics
-   Tracking

------------------------------------------------------------------------

## PHASE 14 --- ADVANCED AGENTS

Build:

-   Sales agent
-   Inventory agent
-   Field agent
-   Management agent
-   Customer agent

Default permission: recommend.

------------------------------------------------------------------------

# 80. MODULE BUILD TEMPLATE

Every module must have a file:

``` text
docs/product/modules/MODULE-ID.md
```

Template:

``` text
# Module

## Purpose

## Users

## Business Problem

## Scope

## Non-Scope

## User Stories

## Functional Requirements

## Data Model

## APIs

## Permissions

## UI

## Flutter Requirements

## Web Requirements

## Offline Requirements

## Notifications

## Audit

## Security

## AI

## Integrations

## Error States

## Acceptance Criteria

## Test Cases

## Dependencies

## Open Questions

## Rollback

## Definition of Done
```

------------------------------------------------------------------------

# 81. USER STORY STANDARD

Use:

``` text
As a [role],
I want to [action],
so that [business outcome].
```

Then add acceptance criteria.

Example:

``` text
VISIT-001

As a field officer,
I want to check into an assigned retailer,
so that my visit is recorded.

Acceptance:
Given the user is authenticated
And the retailer is assigned to the user's scope
When the user starts check-in
Then the app requests location
And records location accuracy
And calculates distance
And presents the resulting visit state
```

------------------------------------------------------------------------

# 82. STOP CONDITIONS FOR ANTIGRAVITY

The agent MUST STOP and ask/refer to an open question when:

-   Requirement conflicts with architecture
-   Security behavior is unspecified
-   Financial calculation is unspecified
-   Permission is ambiguous
-   Existing behavior contradicts the PRD
-   Database migration could cause data loss
-   Integration credentials are missing
-   AI behavior cannot be validated
-   A destructive operation is required
-   A major dependency is unavailable

This is the primary anti-hallucination mechanism.

------------------------------------------------------------------------

# 83. NO FAKE COMPLETION

Agents must never report:

"Implemented successfully"

unless verification was actually run.

Reports must say:

-   Implemented
-   Partially implemented
-   Blocked
-   Not tested
-   Failed
-   Needs approval

------------------------------------------------------------------------

# 84. NO FAKE DATA IN PRODUCTION

Prototype data may exist only in:

-   Development
-   Test
-   Demo fixtures

Clearly identify:

``` text
DEMO DATA
TEST DATA
SYNTHETIC DATA
```

Never confuse it with production data.

------------------------------------------------------------------------

# 85. NO HARDCODED BUSINESS DATA

These prototype values must become configurable/data-driven:

-   Bihar Grid
-   573 counters
-   8 sectors
-   116 target
-   35 days leave
-   09:30--18:30 shift
-   MGO score
-   Territory names
-   Employee names
-   Retailer names
-   GPS coordinates
-   Product data
-   Pricing

The screenshot is evidence of prototype behavior, not a specification
that those values are universally correct.

------------------------------------------------------------------------

# 86. FIELD APP OFFLINE REQUIREMENTS

The field app must cache only the data needed for the user's authorized
scope.

Do not download the entire company database to the device.

Offline data must be:

-   Scoped
-   Encrypted where appropriate
-   Expirable
-   Synchronizable
-   Auditable

------------------------------------------------------------------------

# 87. DEVICE SECURITY

Consider:

-   Secure storage
-   Session expiration
-   Device registration if required
-   App lock
-   Screenshot policy if required
-   Root/jailbreak considerations based on risk
-   Lost-device revocation

Exact policy requires product/security approval.

------------------------------------------------------------------------

# 88. API IDEMPOTENCY

Critical operations such as:

-   Order creation
-   Payment recording
-   Inventory movement
-   Visit submission

must have an idempotency strategy.

Offline retries must never duplicate transactions.

------------------------------------------------------------------------

# 89. EVENT MODEL

Business events include:

``` text
UserCreated
UserAuthenticated
ShiftStarted
ShiftEnded
VisitStarted
VisitCompleted
VisitFlagged
EvidenceCaptured
OrderCreated
OrderApproved
OrderDelivered
InventoryReceived
InventoryTransferred
InventoryAdjusted
DemoCreated
DemoCompleted
CompetitorObserved
KPICompleted
SOPCompleted
LeaveApplied
TAClaimSubmitted
AIRecommendationCreated
AIActionApproved
AIActionExecuted
```

Events must have schema versions.

------------------------------------------------------------------------

# 90. DATA RETENTION

Retention must be configurable and legally reviewed.

Never hard-code deletion periods without an approved policy.

------------------------------------------------------------------------

# 91. EXPORT GOVERNANCE

Exports must:

-   Check authorization
-   Log export
-   Identify requester
-   Record dataset
-   Record timestamp
-   Respect tenant scope

------------------------------------------------------------------------

# 92. AI DATA PRIVACY

Do not automatically send all tenant data to an external model.

AI gateway must enforce:

-   Data minimization
-   Tenant isolation
-   Access controls
-   Provider configuration
-   Logging policy
-   Retention policy

------------------------------------------------------------------------

# 93. AI MODEL FALLBACK

If the primary model is unavailable:

``` text
AI request
→ Provider failure
→ retry according to policy
→ fallback if configured
→ deterministic fallback
→ user receives transparent status
```

Never fabricate an answer because the AI service failed.

------------------------------------------------------------------------

# 94. AI ACTION SAFETY

For any AI action:

``` text
AI proposes
→ validate permissions
→ validate business rules
→ approval if required
→ execute
→ audit
→ return result
```

AI does not directly access unrestricted database operations.

------------------------------------------------------------------------

# 95. AGENT TOOL SECURITY

AI agents receive explicit tools.

Example:

``` text
SalesAgent:
  can_read_sales
  can_read_customers
  can_create_followup

cannot:
  delete_customer
  change_price
  approve_credit
```

Tool permissions are enforced server-side.

------------------------------------------------------------------------

# 96. ENTERPRISE DOCUMENTATION

Required permanent documents:

``` text
README
Architecture
ADRs
Database schema
API reference
Security model
Permission matrix
AI model registry
Prompt registry
Runbooks
Deployment guide
Backup guide
Incident response
Release process
Feature catalogue
Data dictionary
```

------------------------------------------------------------------------

# 97. DATA DICTIONARY

Every major entity must have:

-   Field
-   Type
-   Required/optional
-   Description
-   Allowed values
-   Source
-   Owner
-   Sensitive classification

------------------------------------------------------------------------

# 98. PERMISSION MATRIX

Maintain:

``` text
Role × Module × Action
```

Example:

  -----------------------------------------------------------------------
  Role         Retailer Read       Retailer   Order Create  Order Approve
                                     Create                
  ----------- -------------- -------------- -------------- --------------
  Field                  Yes   Configurable            Yes             No
  Officer                                                  

  Manager                Yes            Yes            Yes   Configurable

  Admin                  Yes            Yes            Yes            Yes

  Super Admin Platform scope Platform scope Platform scope Platform scope
  -----------------------------------------------------------------------

Actual production permissions must be tenant-configurable where
appropriate.

------------------------------------------------------------------------

# 99. ACCEPTANCE TEST STRATEGY

Every module gets:

-   Happy path
-   Validation failure
-   Authorization failure
-   Offline case
-   Network retry
-   Duplicate request
-   Boundary values
-   Empty state
-   Error state
-   Permission variation

------------------------------------------------------------------------

# 100. MASTER QUALITY GATE

A release cannot proceed if any of the following is true:

-   Critical test failure
-   Critical security issue
-   Unreviewed destructive migration
-   Tenant isolation failure
-   Authentication bypass
-   Authorization bypass
-   Data corruption
-   Unresolved critical architecture drift
-   AI makes unsupported claims in a critical workflow
-   Production contains demo credentials
-   Production contains synthetic prototype data

------------------------------------------------------------------------

# 101. ANTIGRAVITY EXECUTION PROTOCOL

For each module, instruct Antigravity:

``` text
PHASE A — DISCOVER
Read AGENTS.md.
Read relevant PRD.
Read ADRs.
Inspect existing code.
Inspect related tests.
Do not modify files.

PHASE B — PLAN
Create implementation plan.
List affected files.
List database changes.
List API changes.
List security impact.
List test cases.
List open questions.

PHASE C — REVIEW
Stop for approval if required.

PHASE D — IMPLEMENT
Implement only approved scope.
Reuse existing abstractions.
Do not invent business rules.

PHASE E — VERIFY
Run static analysis.
Run unit tests.
Run integration tests.
Run E2E tests where applicable.
Run security checks.

PHASE F — DOCUMENT
Update API docs.
Update data dictionary.
Update module documentation.
Update changelog if applicable.

PHASE G — REPORT
Provide:
files changed,
tests,
results,
known limitations,
open questions,
migration status,
security status.
```

------------------------------------------------------------------------

# 102. MASTER BUILD ORDER

The exact sequence should be:

``` text
00 Governance
01 Prototype Archaeology
02 Technology Baseline
03 Design System
04 Repository Foundation
05 Database Foundation
06 API Foundation
07 Authentication
08 Tenant / Organization
09 RBAC
10 Audit
11 Flutter Shell
12 Offline Engine
13 Location Service
14 Field Console
15 Attendance
16 Counter CRM
17 GPS Check-In
18 Visit Evidence
19 Orders
20 Beat
21 Route Execution
22 Farmer CRM
23 Demo
24 Competitor Intelligence
25 TA/DA
26 Leave
27 KPI
28 SOP
29 EOD
30 Web Admin
31 Product/SKU
32 Inventory
33 Schemes
34 BI
35 Search
36 AI Gateway
37 RAG
38 AI Assistant
39 Sales Analyst
40 Inventory Analyst
41 Forecasting
42 Anomaly Detection
43 NeuronCore
44 E2MIS
45 Workflow Engine
46 Commerce
47 Integrations
48 AI Agents
49 Security Hardening
50 Performance
51 Disaster Recovery
52 Production Readiness
53 Launch
```

Each item is a **separate engineering milestone**.

------------------------------------------------------------------------

# 103. MILESTONE ARTIFACTS

Every milestone produces:

``` text
Implementation
Tests
Documentation
Verification Report
Known Issues
Architecture Impact
Migration Status
```

------------------------------------------------------------------------

# 104. SOLO DEVELOPER RULE

The system must minimize:

-   Manual repetitive coding
-   Manual testing
-   Manual deployment
-   Context switching
-   Architecture rediscovery

Automate everything that is deterministic.

The human should primarily make:

-   Product decisions
-   Architecture decisions
-   Security decisions
-   Release decisions

------------------------------------------------------------------------

# 105. THE GOLDEN RULE

Never optimize for:

**"How fast can Antigravity generate code?"**

Optimize for:

**"How safely can Antigravity produce verified, maintainable
software?"**

------------------------------------------------------------------------

# 106. FINAL TARGET ARCHITECTURE

``` text
                         GROWTA
                AI-NATIVE BUSINESS OS
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
     FLUTTER              WEB             AI/AGENTS
   FIELD OS          CONTROL PLANE        NEURONCORE
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                      API PLATFORM
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
    PostgreSQL           Redis             Storage
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                      EVENT LAYER
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
     Workers           Analytics          Integrations
                           │
                           ▼
                     BUSINESS DATA
                           │
                           ▼
                      OUTCOME VAULT
                           │
                           ▼
                     NEURONCORE
                           │
                           ▼
               RECOMMEND → ACT → MEASURE
```

------------------------------------------------------------------------

# 107. SUCCESS DEFINITION

Growta is not complete when:

-   100 screens exist
-   AI chatbot works
-   dashboards look impressive
-   prototype has been copied

Growta is complete when:

1.  Business data is trustworthy.
2.  Tenant boundaries are secure.
3.  Field operations work offline.
4.  Every critical transaction is auditable.
5.  Enterprise configuration is controlled.
6.  Every major workflow is testable.
7.  AI outputs are evaluated and traceable.
8.  Agents cannot silently change critical behavior.
9.  The system can be operated by one founder without requiring a large
    engineering team.
10. New modules can be added without destabilizing existing modules.

------------------------------------------------------------------------

# 108. FIRST ANTIGRAVITY TASK

Do NOT tell Antigravity:

> "Build Growta."

Give it only:

> **"Initialize the Growta Engineering Control Plane according to
> GROWTA-MASTER-PRD-001. Do not implement business modules. First
> inspect the existing prototype repository, produce the prototype
> archaeology report, identify the current technology stack and
> versions, inventory all screens/components/routes/data/API
> dependencies, create the repository governance structure, and stop. Do
> not delete or rewrite existing application code."**

The next task should only begin after the archaeology report is
reviewed.

That is the starting gate for the entire project.

------------------------------------------------------------------------

# 109. MASTER PRINCIPLE

Growta should be built as:

**A product, an architecture, and an engineering-control system
simultaneously.**

The AI writes code.

The specification defines what code is allowed to do.

The tests verify it.

The architecture controls how it fits together.

The audit system records what happened.

The human owner approves important decisions.

That is how a solo builder can progressively construct a very large
enterprise platform without turning the codebase into an uncontrolled
AI-generated prototype.
