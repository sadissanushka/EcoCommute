# EcoCommute Mobile App Shell (Module 3)
**Owner: Zainy TNS (244236B)**

The shared React Native mobile application shell serving all modules:
- **Module 1**: Carpool Ride Matching & Custom Turn-by-Turn Navigation
- **Module 2**: Fleet & Shuttle Booking + Intelligent Seat Allocation
- **Module 3**: Wallet & Carbon Accounting + Fair-Split & Emissions Engine
- **Module 4**: Safety Layer + Real-Time Tracking & Anomaly Detection

### Architecture & Folder Layout
```
src/
├── api/          # Shared apiClient with Bearer interceptor, request-id, and 401 refresh
├── auth/         # Authentication services
├── components/   # Atomic UI design system (Button, Input, Card, ErrorBanner, Loader)
├── navigation/   # AuthStack and MainTabNavigator
├── screens/      # Feature screens (Login, Register, Rides, Shuttles, Wallet, Safety, Profile)
├── store/        # Zustand state stores (auth, user session)
└── theme/        # Central design tokens (colors, typography, spacing, radius)
```

### Running Locally
```bash
npm install
npm run android # or npm run ios
```
