# AGENTS.md - Developer & Agent Instructions for EcoCommute

This document contains strict instructions, system architecture rules, and engineering standards for all AI agents and developers working on the **EcoCommute (Corporate Shuttle & Carpooling)** platform.

---

## 1. Golden Rule: ZERO DEMO CODE / ZERO MOCKING POLICY

### 🚫 Strictly Forbidden:
1. **No Mock Data or Synthetic Placeholders**:
   - Never use fake names (e.g., `"Sarah Jenkins"`, `"Marcus L."`, `"Elena R."`), fake addresses (e.g., `"128 Oakwood Gardens"`), or synthetic coordinates.
   - Never use `Math.random()`, dummy multipliers (e.g., `* 34.6`), or fake random numbers for balances, scores, or carbon savings.
   - Never hardcode OTP codes (e.g., `otpCode === '123456'`) or static QR tokens.
   - Never use fake timers (`setInterval` with simulated ticks), simulated battery drain, or artificial location progression.

2. **No Hallucinated or Simulated API Responses**:
   - Never insert mock fallback objects when an API call fails or when data is empty.
   - If an endpoint returns an empty array, render an authentic empty state (with an action button to create/book), not a fake pre-populated list.
   - If an endpoint does not exist yet, **implement the real endpoint in the backend microservice first** and query the actual PostgreSQL database.

3. **No Low-Resolution or Faked Route Polylines**:
   - Live telematics and corridor maps must load real high-resolution PostGIS linestrings from `safety.route_boundaries` or OSRM/routing engine geometries (`GET /safety/corridor/:tripId`), never low-vertex 4-point straight lines.

---

## 2. Architecture & Microservice Boundaries

The system consists of Dockerized microservices connected via PostgreSQL (PostGIS) and an Nginx API Gateway:

| Service | Port (Container) | Host Port | Purpose |
| :--- | :--- | :--- | :--- |
| **commuter-web** | 80 | 5173 | Vite + React + TypeScript + Tailwind commuter PWA |
| **gateway** | 8080 | 18080 | Reverse proxy & API gateway |
| **auth-service** | 3001 | 3001 | JWT, corporate domain verification, sessions |
| **booking-service** | 3002 | 3002 | Trips, seats, holds, bookings, passenger manifests |
| **routing-engine** | 3000 | 13000 | Spatial route matching, detour calculation, PostGIS |
| **safety-service** | 4400 | 14400 | Live telematics, corridor violation checks, WebSockets |
| **wallet-service** | 8083 | 18083 | LKR balance, corporate green subsidy, escrow |
| **analytics-service** | 8085 | 18085 | Real carbon metrics, commute emissions, compliance |
| **dashboards** | 3005 | 3005 | Corporate fleet manager web application |
| **postgis** | 5432 | 5432 | PostgreSQL 16 with PostGIS 3.4 spatial database |

### Dynamic Port Rules:
- Windows Hyper-V dynamic port exclusions can reserve ports `4327-4426`. Therefore, the `safety-service` WebSocket is mapped to host port **`14400`** (`14400:4400`).

---

## 3. Database & Entity Realism Rules

1. **All Trips and Bookings from PostgreSQL**:
   - Drivers and passengers must interact with `booking.trips`, `booking.bookings`, `booking.seat_holds`, and `booking.stops`.
   - Driver manifests must be queried directly from `booking.bookings` joined with `auth.users` for real passenger profiles.
   - Boarding verification must execute an atomic database transaction: `UPDATE booking.bookings SET status = 'boarded', boarded_at = NOW() WHERE id = $1 AND trip_id = $2`.

2. **Corporate Commute Pass**:
   - The Corporate Pass must use the authenticated employee's real corporate email, department, employee ID, and active booking ID.
   - QR/TOTP tokens must be cryptographically generated or authenticated against the safety service (`/safety/otp/totp` or HMAC token derived from session), never client-side random strings.

3. **Carbon & Wallet Metrics**:
   - Commute CO₂ savings must come directly from `walletApi.getBalance()` or `analytics-service` based on actual passenger-kilometers traveled compared against single-occupancy vehicle baseline emissions (0.171 kg CO₂/km).

---

## 4. UI / UX Design System Standards

Adhere strictly to [ui-ux/eco_corporate_mobility/DESIGN.md](ui-ux/eco_corporate_mobility/DESIGN.md):
- **Flat Design**: Pure flat UI. Strictly NO CSS gradients (`bg-gradient-to-...`), NO neon glows, and NO pulsing keyframe animations (`animate-ping`, `animate-pulse`).
- **Color Tokens**:
  - Primary Green: `#15803d` (Tailwind `green-700`) / `#166534` (Tailwind `green-800`)
  - Accent / Surface: `#f0fdf4` (`green-50`), `#dcfce7` (`green-100`)
  - Neutral Background: `#f8fafc` (`slate-50`) or `#ffffff`
  - Text: `#0f172a` (`slate-900`) for headers, `#475569` (`slate-600`) for secondary
  - Danger / SOS: `#dc2626` (`red-600`)
- **Navigation**:
  - The bottom navigation bar consists of:
    1. **Home** (`home`)
    2. **Driver** (`directions_car`)
    3. **Bookings** (`confirmation_number`)
    4. **Tracking** (`radar`)
    5. **Wallet** (`account_balance_wallet`)
    6. **SOS** (`emergency`)
  - Redundant or dummy tabs (e.g., "Map", "Matches") must remain deleted.

---

## 5. Git Commit & Authorship Protocol

When creating commits:
- Author format: `Pasindu Ruwan <pasinduruwan76@gmail.com>` or designated module lead.
- Meaningful human-like commit messages describing the actual architectural change (e.g., `feat(driver): integrate real passenger manifest and boarding check-in API`).
- Keep repository cleanly buildable with passing tests.
