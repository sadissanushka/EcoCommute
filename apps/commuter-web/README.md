# EcoCommute Commuter Web Application (Phase 1)

Modern, corporate sustainable transit web application built with **React**, **TypeScript**, **Vite**, and **Tailwind CSS**. Designed following the EcoCommute UI/UX design specifications.

## Features Connected to Phase 1 Microservices

1. **Authentication & Onboarding (Module 2 & Module 4)**
   - Corporate Sign-In (`POST /auth/login`) with JWT token storage & session persistence
   - Commuter Registration (`POST /auth/register`) with corporate domain validation
   - Corporate Email OTP Verification (`POST /otp/request` & `POST /otp/confirm`) with 6-digit input & HMAC verification

2. **Commuter Home Hub (Module 1)**
   - User profile & weekly CO₂ savings summary (12.4 kg avoided)
   - Next Ride Spotlight with real-time departure timeline
   - Quick Action Bento Grid for Shuttle Booking, Live Telemetry, Commute Wallet, and Emergency Dispatch

3. **Shuttle Booking & Seat Reservation (Module 2)**
   - Map-first shuttle search (`GET /trips`, `GET /shuttle-routes`)
   - Interactive 14-seat cabin map (`GET /trips/:id`)
   - Real-time seat reservation with transactional outbox (`POST /trips/:id/bookings`)

4. **Live GPS Tracking & Safety Telemetry (Module 4)**
   - RFC 6455 WebSocket client connecting to `/ws` on port 4400
   - Live telematics corridor glow, moving shuttle pin, and speed/heading telemetry
   - PostGIS route distance deviation detection (>150m triggers Stage 1 / Stage 2 escalation alert)

5. **Emergency SOS Incident Dispatch (Module 4)**
   - Interactive 3-second hold-and-press circular SOS countdown ring
   - Automatic coordinate dispatch (`POST /sos`) to Dialog Security Operations and Police 119
   - Direct emergency call shortcuts (119 National, 1990 Suwa Seriya, Dialog HQ +94 11 710 0000)

6. **Commute Wallet & DEFRA 2024 Emissions (Module 3)**
   - Corporate commute wallet balance (LKR 428.50) & Add Funds modal
   - Real-time DEFRA 2024 carbon emissions calculator (`POST /carbon/calculate`)
   - Detour-weighted Fair-Split passenger fare calculator (`POST /fair-split/calculate`)
   - Transaction ledger with verified green subsidies

## Getting Started

```bash
cd apps/commuter-web
npm install
npm run dev
```

Build for production:
```bash
npm run build
```
