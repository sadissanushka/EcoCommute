# EcoCommute — Corporate Employee Shuttle & Carpool Platform
## Master Project Demo & Presentation Guide (`main` Branch)
**Group:** Stack Kings — Group 05  
**Repository:** [`sadissanushka/EcoCommute`](https://github.com/sadissanushka/EcoCommute)  
**Branch:** `main` (Audited, Integrated, and Verified)  

---

## 1. Team Members & Module Assignment Matrix

| Module | Core Responsibility | Assigned Lead | Student ID / Username | Commit Credentials |
| :--- | :--- | :--- | :--- | :--- |
| **Module 1** | **Ride Matching & Custom Navigation Engine** | Thisera W.S.S.A. | 244208R / `sadissanushka` | `sadissanushka <ssinindu@gmail.com>` |
| **Module 2** | **Fleet & Intelligent Seat Booking** | Ruwan Jayawardena | `RuwanCoding` | `RuwanCoding <pasinduruwan76@gmail.com>` |
| **Module 3** | **Corporate Commute Wallet & Carbon Accounting** | Sareefa Zainy | `12sareefazainy` | `12sareefazainy <12sareefazainy@gmail.com>` |
| **Module 4** | **Real-Time Safety & Live Anomaly Telematics** | P. Amaraweera | `DbyDt22` | `DbyDt22 <pariamaraweera22@gmail.com>` |
| **Module 5** | **Analytics, ESG Reporting & Privacy Engine** | Ashen Jeewantha | `AshenJ2003` | `ashjeewantha@gmail.com` |

---

## 2. System Architecture & Live Service Ports

```
                                  [API GATEWAY - Port 8080]
                                              │
         ┌──────────────────┬─────────────────┼──────────────────┬──────────────────┐
         ▼                  ▼                 ▼                  ▼                  ▼
    [Module 1]         [Module 2]        [Module 3]         [Module 4]         [Module 5]
  Routing Engine      Auth & Booking   Wallet & Carbon     Safety & SOS      Analytics & ESG
   (Port 3000)      (Ports 3001/3002)    (Port 3003)        (Port 3004)        (Port 3005)
         │                  │                 │                  │                  │
         └──────────────────┴─────────────────┴──────────────────┴──────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
         [Commuter Web Portal]                               [Mobile React Native]
         (http://localhost:5173)                                (apps/mobile)
```

| Service / Application | Directory | Local URL / Port | Technology Stack |
| :--- | :--- | :--- | :--- |
| **Routing Engine (M1)** | [`services/routing-engine`](file:///c:/Users/ASUS/Documents/dijatra_m1/services/routing-engine) | `http://localhost:3000` | TypeScript, Express, PostGIS, In-Memory Graph |
| **Auth & Booking (M2)** | [`services/auth`](file:///c:/Users/ASUS/Documents/dijatra_m1/services/auth), [`services/booking`](file:///c:/Users/ASUS/Documents/dijatra_m1/services/booking) | `http://localhost:3001`, `3002` | TypeScript, Express, PostgreSQL, JWT |
| **Wallet & Carbon (M3)** | [`services/wallet`](file:///c:/Users/ASUS/Documents/dijatra_m1/services/wallet) | `http://localhost:3003` | TypeScript, Express, Double-Entry Ledger, DEFRA |
| **Safety & SOS (M4)** | [`services/safety`](file:///c:/Users/ASUS/Documents/dijatra_m1/services/safety) | `http://localhost:3004` | TypeScript, Express, WebSocket, Haversine Shield |
| **Analytics & ESG (M5)** | [`services/analytics`](file:///c:/Users/ASUS/Documents/dijatra_m1/services/analytics) | `http://localhost:3005` | TypeScript, Express, Differential Privacy |
| **Commuter Web Client** | [`apps/commuter-web`](file:///c:/Users/ASUS/Documents/dijatra_m1/apps/commuter-web) | `http://localhost:5173` | React 18, Vite, Tailwind CSS, Leaflet |
| **Shuttle Operator Admin**| [`apps/shuttle-admin`](file:///c:/Users/ASUS/Documents/dijatra_m1/apps/shuttle-admin) | `apps/shuttle-admin/index.html` | Vanilla HTML5/CSS3, JavaScript |
| **Executive Dashboards** | [`apps/dashboards`](file:///c:/Users/ASUS/Documents/dijatra_m1/apps/dashboards) | `http://localhost:3006` | Next.js, React, Tailwind CSS |
| **Mobile App Shell** | [`apps/mobile`](file:///c:/Users/ASUS/Documents/dijatra_m1/apps/mobile) | React Native (iOS/Android) | React Native 0.76, React Navigation 7, Zustand |

---

## 3. Step-by-Step Live Presentation Script

---

### Segment 1: Module 1 — Ride Matching & Custom Navigation Engine
**Presenter:** Thisera W.S.S.A. (244208R)  
**Key Theme:** *Hand-crafted Graph Pathfinding, Heuristic Optimization, and Multi-Stop Ordering*

#### What to Show in the Demo:
1. **Interactive Map Studio UI (`http://localhost:5173/studio`):**
   - **Zero Watermark Basemaps:** Highlight the crisp ESRI World Street Map and OpenStreetMap vector layers.
   - **Click-to-Drop Waypoints:** Click anywhere on the map or click the "Drop Pin" button to dynamically place custom locations ($A \rightarrow 1 \rightarrow 2 \dots \rightarrow B$).
   - **Draggable Pins:** Drag any waypoint pin on the map; the multi-stop route immediately recalculates in real-time.
   - **Live Algorithm Switcher (A\* vs. Dijkstra):** Toggle between A\* and Dijkstra to demonstrate node expansion reduction while yielding identical optimal distances.
   - **Animated EV Shuttle Simulation:** Click "Simulate Shuttle Run" to demonstrate smooth vehicle transit traversing every sequential stop.

2. **Live Backend API Showcase (`http://localhost:3000`):**
   - **Optimal Route Oracle (`POST /route`):**
     ```powershell
     Invoke-RestMethod -Uri "http://localhost:3000/route" -Method Post -ContentType "application/json" -Body '{"origin":{"lat":6.9344,"lng":79.8428},"destination":{"lat":6.7969,"lng":79.9018},"algorithm":"astar","mode":"distance"}' | ConvertTo-Json
     ```
   - **Multi-Stop 2-opt Optimizer (`POST /multi-stop/order`):**
     ```powershell
     Invoke-RestMethod -Uri "http://localhost:3000/multi-stop/order" -Method Post -ContentType "application/json" -Body '{"origin":{"name":"Fort CBD","lat":6.9344,"lng":79.8428},"destination":{"name":"Moratuwa UoM","lat":6.7969,"lng":79.9018},"stops":[{"name":"Borella","lat":6.9150,"lng":79.8780},{"name":"Kollupitiya","lat":6.9065,"lng":79.8510},{"name":"Wellawatte","lat":6.8740,"lng":79.8590}]}' | ConvertTo-Json
     ```
   - **Graph Topology & Health (`GET /health`):** Shows PostGIS status and road network scale (19 nodes, 48 directed edges).
   - **Dark Swagger Contract (`http://localhost:3000/docs`):** Figure 6.5 in the evaluation report.
   - **Road Graph Topology Map Plot (`http://localhost:3000/map`):** Figure 6.3 in the evaluation report.

#### Key Talking Points:
- "No third-party routing blackboxes (e.g., Google Directions or Mapbox Directions) were used. The Dijkstra and A\* engines are custom TypeScript implementations."
- "The Haversine distance heuristic fulfills the admissibility condition ($h(n) \le d(n, \text{dest})$), guaranteeing optimal shortest paths with a 3.5× to 7.2× reduction in expanded search vertices."

---

### Segment 2: Module 2 — Fleet & Intelligent Seat Booking
**Presenter:** Ruwan Jayawardena (`RuwanCoding`)  
**Key Theme:** *Corporate Authentication, Shuttle Inventory, and Real-Time Seat Reservation*

#### What to Show in the Demo:
1. **Corporate Login & Registration (`http://localhost:5173/` or `/login`):**
   - Corporate email domain validation (e.g. `@syscolabs.com`, `@dialog.lk`).
   - JWT access token issuance and refresh token rotation with bcrypt password hashing.

2. **Seat Selection & Reservation Flow (`http://localhost:5173/`):**
   - Live shuttle corridor selection (Kaduwela Express, Moratuwa Coastal Line).
   - Interactive 14-seat vehicle layout (`1A, 1B, 2A, 2B...`).
   - Transactional seat locking: booking immediately decrements available seats and generates a digital boarding pass.

3. **Operator Admin Portal (`apps/shuttle-admin/index.html`):**
   - Live fleet vehicle registry (`Toyota Coaster`, `Toyota HiAce`, `Nissan Civilian`).
   - Trip schedule manager and passenger manifest viewer.

4. **Mobile Seat Reservation (`apps/mobile/src/screens/ShuttlesScreen.tsx`):**
   - Native seat layout modal and active boarding pass view.

#### Key Talking Points:
- "Seat reservation uses an atomic transactional reservation engine preventing double-booking race conditions during peak morning commute windows."

---

### Segment 3: Module 3 — Corporate Commute Wallet & Carbon Accounting
**Presenter:** Sareefa Zainy (`12sareefazainy`)  
**Key Theme:** *Double-Entry Audit Ledger, Detour Fair-Split Engine, and DEFRA 2024 Emissions*

#### What to Show in the Demo:
1. **Commuter Wallet UI (`http://localhost:5173/wallet` & Mobile `WalletScreen.tsx`):**
   - **Available Balance:** Displays verified ledger balance in Sri Lankan Rupees (LKR).
   - **Interactive Top-Up:** Instant allowance credit with unique idempotency keys.
   - **Append-Only Audit Trail:** Displays immutable debit/credit entries for trip fares and corporate subsidies.

2. **DEFRA 2024 Carbon Emissions Calculator:**
   - Real-time calculation of avoided emissions using the DEFRA Category 7 passenger vehicle standard ($0.171\text{ kg CO}_2\text{e/km}$ baseline with 72% shared trip consolidation).
   - Demonstrates fuel cost savings calculated against Ceylon Petroleum Corporation (CPC) benchmark fuel prices (Petrol 92: LKR 332/L, Auto Diesel: LKR 307/L).

3. **Fair-Split Engine (`POST /fair-split/calculate`):**
   - Demonstrates detour-weighted passenger cost apportionment with largest-remainder rounding ensuring zero-cent imbalances.

#### Key Talking Points:
- "The wallet uses a strict double-entry append-only ledger where total credits always equal total debits, providing a cryptographically verifiable financial audit trail."

---

### Segment 4: Module 4 — Real-Time Safety & Live Anomaly Telematics
**Presenter:** P. Amaraweera (`DbyDt22`)  
**Key Theme:** *Sub-Second Telematics, Route Deviation Shield, and Instant Emergency SOS*

#### What to Show in the Demo:
1. **Live GPS Telematics (`http://localhost:5173/` & `/tracking`):**
   - High-frequency vehicle telematics stream along the planned route corridor.
   - Stage 1 Haversine orthogonal distance monitoring: flags deviations exceeding 500 meters.

2. **Emergency SOS Incident Dispatch (`http://localhost:5173/emergency` & Mobile `SafetyScreen.tsx`):**
   - **3-Second Press-and-Hold Trigger:** Prevents accidental activation while ensuring rapid panic dispatch.
   - **Crisis Broadcast:** Dispatches instant high-priority incident payload (`#SOS-2026-X`) containing vehicle registration, driver contact, and GPS coordinates to the 24/7 security desk.
   - **Resolution Workflow:** Secure "Mark As Safe" action to stand down emergency telemetry.

3. **HMAC-SHA256 Corporate OTP Boarding (`http://localhost:5173/verification`):**
   - Demonstrates time-based cryptographic one-time passcode verification required before passenger boarding.

#### Key Talking Points:
- "Safety is active, not passive. The system combines sub-second deviation monitoring with an escalation ladder state machine to detect unapproved route diversions before incidents occur."

---

### Segment 5: Module 5 — Analytics, ESG Reporting & Privacy Engine
**Presenter:** Ashen Jeewantha (`AshenJ2003`)  
**Key Theme:** *Enterprise ESG Scope 3 Auditing, Spatial Density, and Differential Privacy*

#### What to Show in the Demo:
1. **Enterprise ESG Executive Dashboard (`apps/dashboards`):**
   - Corporate commute carbon footprint reduction metrics compliant with GRI 305 Scope 3 standards.
   - Monthly avoided mileage, fuel consumption trends, and modal split graphs.

2. **Spatial Zone Density Analysis (`GET /analytics/zones`):**
   - PostGIS spatial clustering identifying top Colombo arterial commuter corridors (Galle Road, High-Level Road, Parliament Road).

3. **Laplace Differential Privacy Engine:**
   - Demonstrates mathematical noise addition ($\epsilon$-differential privacy and $k$-anonymity) on origin-destination matrices prior to exporting public transport planning data to policymakers.

#### Key Talking Points:
- "Corporate transport data exported to government urban planners is protected via Laplace differential privacy, guaranteeing that individual commuter travel habits cannot be reverse-engineered."

---

## 4. End-to-End Commuter Journey (Full System Integration Demo)

During the final presentation, walk the examiners through one complete end-to-end user story:

```
[1. Route Discovery] ──► [2. Seat Booking] ──► [3. Boarding OTP] ──► [4. Safe Transit] ──► [5. Fare & ESG]
   Module 1 Router          Module 2 Fleet        Module 4 Safety       Module 4 Telematics    Module 3 & 5
  Finds optimal path       Reserves seat 1A      Verifies corporate     Monitors 500m shield   Deducts fare & logs
  A* Fort ➔ Moratuwa       Generates pass        employee identity      Transmits live GPS     avoided CO2 to ESG
```

1. **Step 1 — Search & Match:** Commuter searches for a morning trip from Malabe to Colombo Fort in [`MapStudio`](file:///c:/Users/ASUS/Documents/dijatra_m1/apps/commuter-web/src/pages/MapStudio.tsx). Module 1 calculates the 14.2 km corridor with an 8-node path in under 15ms.
2. **Step 2 — Seat Reservation:** Commuter selects Seat 2B in [`apps/commuter-web`](file:///c:/Users/ASUS/Documents/dijatra_m1/apps/commuter-web). Module 2 reserves the seat and decrements available inventory.
3. **Step 3 — Identity & Boarding:** Passenger presents HMAC-SHA256 one-time boarding passcode verified by Module 4.
4. **Step 4 — In-Transit Telematics:** Shuttle begins trip. Module 4's Route Deviation Shield verifies GPS coordinates stay within 500m of Module 1's planned polyline.
5. **Step 5 — Wallet Settlement & ESG:** Upon trip completion, Module 3's double-entry ledger debits the passenger wallet, credits fuel reimbursement, and records 2.85 kg of avoided CO₂ into Module 5's ESG corporate audit ledger.

---

## 5. Verification Checklist & Test Pass Summary

| Module | Verification Harness | Status |
| :--- | :--- | :--- |
| **Module 1 (Navigation)** | `cd services/routing-engine && npm test` | **16/16 Jest Tests Passed** |
| **Module 2 (Booking)** | `services/booking/tests` & OpenAPI Contract | **Verified** |
| **Module 3 (Wallet)** | `services/wallet/tests` (Ledger, FairSplit, Emissions) | **Verified** |
| **Module 4 (Safety)** | Synthetic GPS traces & PostGIS ST_Distance | **Verified** |
| **Module 5 (Analytics)** | Spatial zone breakdown & Differential Privacy unit tests | **Verified** |
| **Frontend Web Client** | `cd apps/commuter-web && npm run build` | **Build Success (Zero TS Errors)** |
| **Git Monorepo** | Clean `main` branch with author credentials | **All Merged & Pushed to Remote** |
