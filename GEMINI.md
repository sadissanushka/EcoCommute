# GEMINI.md - EcoCommute Agent Rules & Constraints

See [AGENTS.md](file:///d:/EcoCommute/AGENTS.md) for full architecture details.

## Core Rules for Gemini / Antigravity Agent:
1. **ABSOLUTELY NO DEMO CODE OR MOCKING**:
   - Zero synthetic mock arrays, fake names, fake addresses (`"128 Oakwood Gardens"`, `"Sarah Jenkins"`), or fake OTP checks (`'123456'`).
   - Zero `Math.random()`, fake multipliers, or simulated `setInterval` progress loops.
   - All data MUST come directly from PostgreSQL and the corresponding microservices (`auth`, `booking`, `safety`, `wallet`, `analytics`).
   - When an endpoint is missing, write the real backend code, migrations, and routes. Never invent dummy front-end fallbacks.

2. **DATABASE-BACKED DRIVER & PASSENGER WORKFLOWS**:
   - Driver manifest must be retrieved from the real database (`booking.bookings` joined with user details).
   - Passenger boarding scan must perform real validation and persist status changes into the database.
   - Corporate Pass must use real authenticated user session details and a real TOTP / cryptographic HMAC verification mechanism.

3. **REAL TELEMATICS & ROUTE GEOMETRY**:
   - Live telematics must use real WebSocket stream messages (`shuttle_safety_service` on port `14400:4400`).
   - Route corridors on maps must render the actual high-resolution PostGIS linestring from `safety.route_boundaries` (`GET /safety/corridor/:tripId`).

4. **DESIGN SYSTEM**:
   - Strict flat design (no gradients, no pulsing circles). Primary green `#15803d` / `#166534`.
