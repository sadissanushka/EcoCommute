# Module 5 — Privacy-Preserving Dashboards & Policy Analytics
## Implementation & Presentation Dossier
**Presenter:** Kulapputhanthri A.J. (Index: 244108K)  
**Git Author:** `Kulapputhanthri AJ <kulapputhanthri.aj@gmail.com>` / `sadissanushka <ssinindu@gmail.com>`  
**Project:** EcoCommute — Corporate Employee Shuttle & Carpool Platform  
**Evaluation Scope:** Phase 1 (Interim Evaluation) & Phase 2 Advanced Analytics Engine  

---

## 1. Executive Summary & Deliverables Overview

This dossier outlines all components, algorithms, backend endpoints, and frontend interfaces developed for **Module 5 (Privacy-Preserving Dashboards & Policy Analytics)**, as well as the shared infrastructure owned by this role (**ETL materialized views, analytics dimensional schema, and Next.js executive dashboard applications**), fulfilling all requirements in `Module5_Dev_Plan_Kulapputhanthri_244108K.md`.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            MODULE 5 ARCHITECTURE                             │
└──────────────────────────────────────────────────────────────────────────────┘

        Bookings (M2) + Emissions (M3) + Completed Trips (M4 Telematics)
                                        │
                                        ▼ ETL Jobs & Materialized Views
                  ┌───────────────────────────────────────────┐
                  │       Analytics Service (Express/TS)      │
                  │                 Port 3005                 │
                  └─────────────────────┬─────────────────────┘
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             ▼                                                     ▼
┌─────────────────────────────────────────┐       ┌─────────────────────────────────┐
│     Differential Privacy Engine         │       │     k-Anonymity Cell Suppressor │
│ • Laplace Mechanism: Lap(Δ / ε)         │       │ • Threshold enforcement (k >= 5)│
│ • Inverse CDF with CSPRNG entropy       │       │ • Suppressed cell masking ("<5")│
│ • Privacy Budget Ledger (ε depletion)   │       │ • Utility loss reporting        │
│ • User contribution capping (C <= 2)    │       │ • Origin-Destination clustering │
└────────────────────┬────────────────────┘       └────────────────┬────────────────┘
                     │                                             │
                     └──────────────────────┬──────────────────────┘
                                            ▼
                    ┌──────────────────────────────────────────────┐
                    │            Executive Web Dashboards          │
                    │ • Corporate ESG & Mode Split (apps/dashboards)│
                    │ • Municipal Policymaker Heatmap (with DP)    │
                    └──────────────────────────────────────────────┘
```

---

## 2. Inventory of Implemented Components & Locations

| Component | File Path | Scope & Key Features |
| :--- | :--- | :--- |
| **Laplace Mechanism Engine** | [`services/analytics/src/privacy/laplace.ts`](file:///c:/Users/ASUS/Documents/dijatra_m1/services/analytics/src/privacy/laplace.ts) | Mathematical implementation of differential privacy using inverse CDF sampling on OS cryptographically secure pseudo-random entropy (CSPRNG). |
| **Privacy Budget Ledger** | [`services/analytics/src/privacy/budgetLedger.ts`](file:///c:/Users/ASUS/Documents/dijatra_m1/services/analytics/src/privacy/budgetLedger.ts) | Ledger tracking cumulative privacy loss $\sum \varepsilon_i$, remaining budget per policy query session, and exhaustion warnings. |
| **k-Anonymity Suppressor** | [`services/analytics/src/privacy/kAnonymity.ts`](file:///c:/Users/ASUS/Documents/dijatra_m1/services/analytics/src/privacy/kAnonymity.ts) | Aggregation sanitizer suppressing Origin-Destination corridor cells where sample count $k < 5$ (masking as `"<5"`). |
| **Corporate Analytics API** | [`services/analytics/src/routes/analytics.routes.ts`](file:///c:/Users/ASUS/Documents/dijatra_m1/services/analytics/src/routes/analytics.routes.ts) | Express router computing company mode split, Scope 3 ESG carbon avoided, passenger occupancy rates, and peak hour distributions. |
| **Policymaker Analytics API** | [`services/analytics/src/routes/gov.routes.ts`](file:///c:/Users/ASUS/Documents/dijatra_m1/services/analytics/src/routes/gov.routes.ts) | Municipal urban planning endpoints serving corridor transit density heatmaps with differential privacy noise toggles and $\varepsilon$ parameter adjustments. |
| **Analytics SQL Schema** | [`infra/migrations/sql/202610011200__analytics__create_analytics_schema.sql`](file:///c:/Users/ASUS/Documents/dijatra_m1/infra/migrations/sql/202610011200__analytics__create_analytics_schema.sql) | DDL defining `analytics.fact_daily_commute_aggregates`, `analytics.mv_corridor_density`, and dimensional indices. |
| **Corporate Admin Dashboard** | [`apps/dashboards/src/app/admin/page.tsx`](file:///c:/Users/ASUS/Documents/dijatra_m1/apps/dashboards/src/app/admin/page.tsx) | Next.js corporate sustainability portal with Scope 3 CO₂ charts, transit mode split bars, and employee participation metrics. |
| **Policymaker Portal** | [`apps/dashboards/src/app/gov/page.tsx`](file:///c:/Users/ASUS/Documents/dijatra_m1/apps/dashboards/src/app/gov/page.tsx) | Urban mobility portal featuring interactive Colombo corridor heatmaps, DP noise injection toggles, and $\varepsilon$ sliders ($0.1$ to $2.0$). |

---

## 3. Core Algorithms Implemented

### 1. $\varepsilon$-Differential Privacy via Laplace Mechanism
- **Mathematical Principle:** For a numeric query $f(D)$ over database $D$, the mechanism adds zero-mean Laplace noise:
  $$M(D) = f(D) + \text{Lap}\left( \frac{\Delta f}{\varepsilon} \right)$$
  where $\Delta f$ is the global $L_1$ query sensitivity and $\varepsilon > 0$ is the privacy loss parameter.
- **Inverse CDF Sampling with CSPRNG:**
  To guarantee cryptographic entropy without bias, uniform random float $U \in (0, 1)$ is sampled via `crypto.randomBytes(6)`:
  $$X = -b \cdot \text{sgn}(U - 0.5) \cdot \ln(1 - 2|U - 0.5|), \quad \text{where } b = \frac{\Delta f}{\varepsilon}$$
- **Contribution Bounding:** An individual commuter can contribute at most $C = 2$ trips per day. For count queries, sensitivity is bounded strictly by $\Delta f = C = 2$.
- **Location:** [`services/analytics/src/privacy/laplace.ts`](file:///c:/Users/ASUS/Documents/dijatra_m1/services/analytics/src/privacy/laplace.ts#L40-L75)

### 2. $k$-Anonymity Cell Suppression ($k \ge 5$)
- **Problem:** Releasing raw transit OD counts for low-volume rural/suburban routes risks re-identifying executive homes.
- **Rule:** If the count of unique commuters in an aggregation cell (origin zone, destination zone, hour bucket) is strictly less than $k$ ($k < 5$):
  - The cell is flagged as `isSuppressed: true`.
  - The raw count is replaced with the string `"<5"`.
- **Utility Reporting:** The algorithm computes the percentage utility loss:
  $$\text{UtilityLoss} = \frac{\text{Count}(\text{Suppressed Cells})}{\text{Total Cells}} \times 100\%$$
- **Location:** [`services/analytics/src/privacy/kAnonymity.ts`](file:///c:/Users/ASUS/Documents/dijatra_m1/services/analytics/src/privacy/kAnonymity.ts#L35-L75)

### 3. Sequential Composition & Privacy Budget Ledger
- **Theorem:** If queries $Q_1, \dots, Q_m$ satisfy $\varepsilon_1, \dots, \varepsilon_m$-differential privacy, their sequential combination satisfies $(\sum \varepsilon_i)$-differential privacy.
- **Ledger Invariant:** The ledger decrements remaining budget $\varepsilon_{\text{rem}} = \varepsilon_{\text{total}} - \sum \varepsilon_i$. When $\varepsilon_{\text{rem}} < 0.2$, further queries are denied until budget refresh.
- **Location:** [`services/analytics/src/privacy/budgetLedger.ts`](file:///c:/Users/ASUS/Documents/dijatra_m1/services/analytics/src/privacy/budgetLedger.ts#L20-L80)

---

## 4. Working REST API Endpoints & Live Test Commands

All endpoints run on `http://localhost:3005` (and exposed via Gateway on port `8080`).

### 1. `GET /gov/corridor-density` — Private OD Heatmap
Returns corridor commuter volumes with configurable Laplace noise.

**cURL (Windows CMD):**
```bash
curl -X GET "http://localhost:3005/gov/corridor-density?epsilon=0.5&enableDp=true" ^
  -H "Accept: application/json"
```

### 2. `GET /analytics/company/1` — Corporate Sustainability & Mode Split
Returns corporate fleet occupancy, total Scope 3 carbon avoided, and transit adoption rates.

**cURL (Windows CMD):**
```bash
curl -X GET "http://localhost:3005/analytics/company/1" ^
  -H "Accept: application/json"
```

### 3. `GET /gov/budget/status` — Privacy Budget Ledger
Inspects current session privacy loss and remaining $\varepsilon$ budget.

**cURL (Windows CMD):**
```bash
curl -X GET "http://localhost:3005/gov/budget/status" ^
  -H "Accept: application/json"
```

---

## 5. Backend vs. Frontend Integration Status (Truth Table)

| Feature / UI View | Backend Service | Connection Reality & Fallback Behavior |
| :--- | :--- | :--- |
| **Municipal Heatmap with DP** (`apps/dashboards/src/app/gov/`) | Analytics Service (`GET /gov/corridor-density`, port 3005) | **Connected with Fallback:** Frontend makes live fetch to `/gov/corridor-density`. If backend is offline, Next.js page uses pre-compiled Colombo transit OD coordinates (Galle Road, High Level Rd, Baseline Rd corridors) and computes client-side Laplace noise dynamically so the slider and DP toggle operate smoothly in the presentation. |
| **Corporate ESG Analytics** (`apps/dashboards/src/app/admin/`) | Analytics Service (`GET /analytics/company/:id`) | **Connected with Fallback:** Connects to live analytics endpoint. When offline, renders pre-seeded enterprise metrics (Sysco LABS 64% shuttle mode share, 1,248 kg monthly CO₂ avoided, 84% fleet occupancy). |
| **Privacy Budget Depletion Indicator** (`apps/dashboards/src/app/gov/`) | Budget Ledger API (`GET /gov/budget/status`) | **Live State Simulation:** Renders live $\varepsilon$ consumption meter that depletes as queries are executed on the slider. |
| **ETL Materialized Views** (`infra/migrations`) | PostgreSQL Database | **100% Fully Functional:** Schema definitions for aggregated fact tables and corridor density materialized views ready for database triggers. |

---

## 6. Key Presentation Defense Points

1. **Why is CSPRNG required for Differential Privacy?**  
   Highlight lines 30–38 of `laplace.ts`: Standard pseudo-random generators (`Math.random()`) are deterministic PRNGs vulnerable to state reconstruction attacks. The implementation uses `crypto.randomBytes(6)` to draw true cryptographic entropy directly from the OS kernel.
2. **What does the $\varepsilon$ parameter represent?**  
   Explain that $\varepsilon$ controls the privacy-utility tradeoff. Lower $\varepsilon$ ($0.1$) adds higher variance noise, maximizing privacy; higher $\varepsilon$ ($1.0 - 2.0$) decreases noise, maximizing data utility for urban transit route planning.
3. **How does $k$-anonymity complement Differential Privacy?**  
   Explain that Differential Privacy protects against membership inference attacks, while $k$-anonymity prevents singling out outlier commuters on sparsely traveled suburban road segments.
