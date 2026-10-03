# ADR-0001: Modular Monolith Architecture & Prototype Baseline Preservation

**Status:** Approved  
**Date:** 2026-10-04  
**Context:** GROWTA-MASTER-PRD-001 (Section 5, 77, 108)  

---

## 1. Context & Problem Statement
Growta is evolving from a functional agricultural field sales prototype (AgriField Pro / Bihar Grid) into an Enterprise AI-Native Operating System. We must decide how to architect the backend and evolve the existing codebase without causing regressions or breaking active field operations.

## 2. Decision
1. **Modular Monolith First:** We adopt a modular monolith architecture with strict domain boundaries rather than premature microservices.
2. **Preserve Prototype Baseline:** We do not rewrite or discard working prototype code. The prototype's 1,146 retailers, MGO 100-pt KPI algorithms, Leaflet TSP routing, dynamic forms, and TA/DA models are preserved as the ground-truth domain specification.
3. **Phased Evolution:** We progressively wrap and replace prototype client-side mock logic with hardened, multi-tenant API services following the Master Build Order (Section 102).

## 3. Consequences
- **Positive:** Maximum stability; zero downtime for current users; rapid solo-founder iterations; clear auditability.
- **Negative:** Requires disciplined code boundaries to avoid coupling during the transition phase.
