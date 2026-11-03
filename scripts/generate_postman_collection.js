const fs = require('fs');
const path = require('path');

const collection = {
  info: {
    _postman_id: "ecocommute-e2e-verification-v2",
    name: "EcoCommute — End-to-End API Verification",
    description: "Automated Postman Collection replicating scripts/verify_all_endpoints.ts across Modules 1 to 5 up to Phase 2.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  item: [
    {
      name: "00. Auth Setup (Generate Tokens)",
      item: [
        {
          name: "Login as Employee (emp1)",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test('Status code is 200', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "const json = pm.response.json();",
                  "if (json.tokens && json.tokens.accessToken) {",
                  "    pm.environment.set('employeeToken', json.tokens.accessToken);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "emp1@syscolabs.com", password: "Password123!" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/auth/login", host: ["{{baseUrl}}"], path: ["auth", "login"] }
          }
        },
        {
          name: "Login as Admin (admin)",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test('Status code is 200', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "const json = pm.response.json();",
                  "if (json.tokens && json.tokens.accessToken) {",
                  "    pm.environment.set('adminToken', json.tokens.accessToken);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "admin@syscolabs.com", password: "Password123!" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/auth/login", host: ["{{baseUrl}}"], path: ["auth", "login"] }
          }
        },
        {
          name: "Login as Policymaker (policymaker)",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test('Status code is 200', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "const json = pm.response.json();",
                  "if (json.tokens && json.tokens.accessToken) {",
                  "    pm.environment.set('policymakerToken', json.tokens.accessToken);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "policymaker@syscolabs.com", password: "Password123!" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/auth/login", host: ["{{baseUrl}}"], path: ["auth", "login"] }
          }
        }
      ]
    },
    {
      name: "Module 1 - Routing Engine",
      item: [
        {
          name: "GET /health (Routing)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: { method: "GET", header: [], url: { raw: "{{routingUrl}}/health", host: ["{{routingUrl}}"], path: ["health"] } }
        },
        {
          name: "POST /route (Dijkstra Shortest Path)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ origin: { lat: 6.9344, lng: 79.8428 }, destination: { lat: 6.7969, lng: 79.9018 }, algorithm: "dijkstra", mode: "distance" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/route", host: ["{{baseUrl}}"], path: ["route"] }
          }
        },
        {
          name: "POST /route (Validation 400 on invalid lat)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 400', () => pm.response.to.have.status(400));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ origin: { lat: 999.0, lng: 79.8428 }, destination: { lat: 6.7969, lng: 79.9018 } }, null, 2)
            },
            url: { raw: "{{baseUrl}}/route", host: ["{{baseUrl}}"], path: ["route"] }
          }
        },
        {
          name: "POST /route (A* Heuristic Shortest Path)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ origin: { lat: 6.9344, lng: 79.8428 }, destination: { lat: 6.7969, lng: 79.9018 }, algorithm: "astar", mode: "distance" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/route", host: ["{{baseUrl}}"], path: ["route"] }
          }
        },
        {
          name: "POST /route (A* Fastest Path by Time)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ origin: { lat: 6.9344, lng: 79.8428 }, destination: { lat: 6.7969, lng: 79.9018 }, algorithm: "astar", mode: "time" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/route", host: ["{{baseUrl}}"], path: ["route"] }
          }
        },
        {
          name: "GET /graph-geojson",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: { method: "GET", header: [], url: { raw: "{{routingUrl}}/graph-geojson", host: ["{{routingUrl}}"], path: ["graph-geojson"] } }
        },
        {
          name: "GET /openapi.json",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: { method: "GET", header: [], url: { raw: "{{routingUrl}}/openapi.json", host: ["{{routingUrl}}"], path: ["openapi.json"] } }
        },
        {
          name: "POST /rides (Publish Ride Offer)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 201', () => pm.response.to.have.status(201));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                type: "offer",
                userId: "driver-101",
                userName: "Nimal Perera",
                origin: { lat: 6.9344, lng: 79.8428 },
                destination: { lat: 6.7969, lng: 79.9018 },
                seats: 3,
                womenOnly: false
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/rides", host: ["{{baseUrl}}"], path: ["rides"] }
          }
        },
        {
          name: "POST /rides (Publish Ride Request)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 201', () => pm.response.to.have.status(201));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                type: "request",
                userId: "rider-202",
                userName: "Sunil Silva",
                origin: { lat: 6.9271, lng: 79.8612 },
                destination: { lat: 6.8000, lng: 79.9000 },
                seats: 1,
                womenOnly: false
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/rides", host: ["{{baseUrl}}"], path: ["rides"] }
          }
        },
        {
          name: "GET /rides (List Active)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: { method: "GET", header: [], url: { raw: "{{baseUrl}}/rides", host: ["{{baseUrl}}"], path: ["rides"] } }
        },
        {
          name: "GET /matches (Ranked Candidate Matches)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: { method: "GET", header: [], url: { raw: "{{baseUrl}}/matches", host: ["{{baseUrl}}"], path: ["matches"] } }
        },
        {
          name: "POST /multi-stop/order (2-opt Pickup Tour)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                origin: { name: "Fort CBD", lat: 6.9344, lng: 79.8428 },
                destination: { name: "Moratuwa UoM", lat: 6.7969, lng: 79.9018 },
                stops: [
                  { name: "Borella", lat: 6.915, lng: 79.878 },
                  { name: "Kollupitiya", lat: 6.9065, lng: 79.851 },
                  { name: "Wellawatte", lat: 6.874, lng: 79.859 }
                ]
              }, null, 2)
            },
            url: { raw: "{{routingUrl}}/multi-stop/order", host: ["{{routingUrl}}"], path: ["multi-stop", "order"] }
          }
        }
      ]
    },
    {
      name: "Module 2 - Authentication",
      item: [
        {
          name: "GET /health (Auth)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: { method: "GET", header: [], url: { raw: "{{authUrl}}/health", host: ["{{authUrl}}"], path: ["health"] } }
        },
        {
          name: "POST /auth/register (New User)",
          event: [
            {
              listen: "prerequest",
              script: {
                exec: ["pm.variables.set('testEmail', 'verify.' + Date.now() + '@syscolabs.com');"],
                type: "text/javascript"
              }
            },
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test('Status is 201', () => pm.response.to.have.status(201));",
                  "const json = pm.response.json();",
                  "if (json.tokens && json.tokens.refreshToken) {",
                  "    pm.environment.set('registeredRefreshToken', json.tokens.refreshToken);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "{{testEmail}}",
                password: "StrongPassword123!",
                fullName: "Kamal Jayawardena",
                role: "employee",
                gender: "male"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/auth/register", host: ["{{baseUrl}}"], path: ["auth", "register"] }
          }
        },
        {
          name: "POST /auth/register (Validation Error 400)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 400', () => pm.response.to.have.status(400));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "not-an-email", password: "short" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/auth/register", host: ["{{baseUrl}}"], path: ["auth", "register"] }
          }
        },
        {
          name: "POST /auth/login (Success 200)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "emp1@syscolabs.com", password: "Password123!" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/auth/login", host: ["{{baseUrl}}"], path: ["auth", "login"] }
          }
        },
        {
          name: "POST /auth/login (Invalid Password 401)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 401', () => pm.response.to.have.status(401));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "emp1@syscolabs.com", password: "WrongPassword!" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/auth/login", host: ["{{baseUrl}}"], path: ["auth", "login"] }
          }
        },
        {
          name: "POST /auth/refresh (Token Rotation 200)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ refreshToken: "{{registeredRefreshToken}}" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/auth/refresh", host: ["{{baseUrl}}"], path: ["auth", "refresh"] }
          }
        },
        {
          name: "GET /auth/me (Authenticated User)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{employeeToken}}" }],
            url: { raw: "{{baseUrl}}/auth/me", host: ["{{baseUrl}}"], path: ["auth", "me"] }
          }
        },
        {
          name: "GET /auth/me (Unauthorized 401)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 401', () => pm.response.to.have.status(401));"], type: "text/javascript" } }],
          request: {
            method: "GET",
            header: [],
            url: { raw: "{{baseUrl}}/auth/me", host: ["{{baseUrl}}"], path: ["auth", "me"] }
          }
        }
      ]
    },
    {
      name: "Module 2 - Booking Microservice",
      item: [
        {
          name: "GET /health (Booking)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: { method: "GET", header: [], url: { raw: "{{bookingUrl}}/health", host: ["{{bookingUrl}}"], path: ["health"] } }
        },
        {
          name: "GET /trips (Trip Search)",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test('Status is 200', () => pm.response.to.have.status(200));",
                  "const json = pm.response.json();",
                  "if (json.trips && json.trips.length > 0) {",
                  "    pm.environment.set('createdTripId', json.trips[0].id);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/trips?seatsNeeded=1",
              host: ["{{baseUrl}}"],
              path: ["trips"],
              query: [{ key: "seatsNeeded", value: "1" }]
            }
          }
        },
        {
          name: "GET /trips/:id (Detail & Seat Matrix)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "GET",
            header: [],
            url: { raw: "{{baseUrl}}/trips/{{createdTripId}}", host: ["{{baseUrl}}"], path: ["trips", "{{createdTripId}}"] }
          }
        },
        {
          name: "GET /vehicles (Fleet List)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: { method: "GET", header: [], url: { raw: "{{baseUrl}}/vehicles", host: ["{{baseUrl}}"], path: ["vehicles"] } }
        },
        {
          name: "POST /vehicles (Admin Create)",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test('Status is 201', () => pm.response.to.have.status(201));",
                  "const json = pm.response.json();",
                  "if (json.vehicle && json.vehicle.id) {",
                  "    pm.environment.set('createdVehicleId', json.vehicle.id);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                plateNo: "NA-" + Math.floor(1000 + Math.random() * 9000),
                type: "Toyota HiAce Luxury",
                capacity: 14,
                seatLayoutJson: { rows: 4, cols: 4, aisles: [2] }
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/vehicles", host: ["{{baseUrl}}"], path: ["vehicles"] }
          }
        },
        {
          name: "PATCH /vehicles/:id (Admin Update)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "PATCH",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ active: true, type: "Toyota HiAce Premium" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/vehicles/{{createdVehicleId}}", host: ["{{baseUrl}}"], path: ["vehicles", "{{createdVehicleId}}"] }
          }
        },
        {
          name: "POST /trips (Admin Schedule)",
          event: [
            {
              listen: "prerequest",
              script: {
                exec: [
                  "const now = Date.now();",
                  "pm.variables.set('futureDepart', new Date(now + 24 * 60 * 60 * 1000).toISOString());",
                  "pm.variables.set('futureArrive', new Date(now + 25 * 60 * 60 * 1000).toISOString());",
                  "pm.variables.set('futureCutoff', new Date(now + 23 * 60 * 60 * 1000).toISOString());"
                ],
                type: "text/javascript"
              }
            },
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test('Status is 201', () => pm.response.to.have.status(201));",
                  "const json = pm.response.json();",
                  "if (json.trip && json.trip.id) {",
                  "    pm.environment.set('createdTripId', json.trip.id);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                routeId: 1,
                vehicleId: 1,
                departAt: "{{futureDepart}}",
                arriveAt: "{{futureArrive}}",
                bookingCutoffAt: "{{futureCutoff}}"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/trips", host: ["{{baseUrl}}"], path: ["trips"] }
          }
        },
        {
          name: "POST /trips/:id/bookings (Seat Allocation)",
          event: [
            {
              listen: "prerequest",
              script: {
                exec: [
                  "const key = 'idem-' + Date.now() + '-' + Math.random();",
                  "pm.environment.set('idempotencyKey', key);"
                ],
                type: "text/javascript"
              }
            },
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test('Status is 201', () => pm.response.to.have.status(201));",
                  "const json = pm.response.json();",
                  "if (json.booking && json.booking.id) {",
                  "    pm.environment.set('createdBookingId', json.booking.id);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{employeeToken}}" },
              { key: "Idempotency-Key", value: "{{idempotencyKey}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ partySize: 1 }, null, 2)
            },
            url: { raw: "{{baseUrl}}/trips/{{createdTripId}}/bookings", host: ["{{baseUrl}}"], path: ["trips", "{{createdTripId}}", "bookings"] }
          }
        },
        {
          name: "POST /trips/:id/bookings (Idempotent Replay 200)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{employeeToken}}" },
              { key: "Idempotency-Key", value: "{{idempotencyKey}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ partySize: 1 }, null, 2)
            },
            url: { raw: "{{baseUrl}}/trips/{{createdTripId}}/bookings", host: ["{{baseUrl}}"], path: ["trips", "{{createdTripId}}", "bookings"] }
          }
        },
        {
          name: "POST /trips/:id/bookings (Idempotency Mismatch 422)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 422', () => pm.response.to.have.status(422));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{employeeToken}}" },
              { key: "Idempotency-Key", value: "{{idempotencyKey}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ partySize: 2 }, null, 2)
            },
            url: { raw: "{{baseUrl}}/trips/{{createdTripId}}/bookings", host: ["{{baseUrl}}"], path: ["trips", "{{createdTripId}}", "bookings"] }
          }
        },
        {
          name: "GET /bookings/me (Current User Bookings)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{employeeToken}}" }],
            url: { raw: "{{baseUrl}}/bookings/me", host: ["{{baseUrl}}"], path: ["bookings", "me"] }
          }
        },
        {
          name: "GET /bookings/:id (Booking Details)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{employeeToken}}" }],
            url: { raw: "{{baseUrl}}/bookings/{{createdBookingId}}", host: ["{{baseUrl}}"], path: ["bookings", "{{createdBookingId}}"] }
          }
        },
        {
          name: "DELETE /bookings/:id (Cancel Booking)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "DELETE",
            header: [{ key: "Authorization", value: "Bearer {{employeeToken}}" }],
            url: { raw: "{{baseUrl}}/bookings/{{createdBookingId}}", host: ["{{baseUrl}}"], path: ["bookings", "{{createdBookingId}}"] }
          }
        }
      ]
    },
    {
      name: "Module 3 - Wallet & Carbon Accounting",
      item: [
        {
          name: "GET /health (Wallet)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: { method: "GET", header: [], url: { raw: "{{walletUrl}}/health", host: ["{{walletUrl}}"], path: ["health"] } }
        },
        {
          name: "GET /carbon/factors (DEFRA 2024 Lookup)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: { method: "GET", header: [], url: { raw: "{{baseUrl}}/carbon/factors", host: ["{{baseUrl}}"], path: ["carbon", "factors"] } }
        },
        {
          name: "GET /carbon/prices (CPC Fuel Prices)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: { method: "GET", header: [], url: { raw: "{{baseUrl}}/carbon/prices", host: ["{{baseUrl}}"], path: ["carbon", "prices"] } }
        },
        {
          name: "POST /carbon/calculate (Trip Fuel & CO2)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ distanceKm: 28.5, kmPerLitre: 12.0, fuelTypeCode: "PETROL_92", priceMinorPerLitre: 33200 }, null, 2)
            },
            url: { raw: "{{baseUrl}}/carbon/calculate", host: ["{{baseUrl}}"], path: ["carbon", "calculate"] }
          }
        },
        {
          name: "POST /carbon/avoided (Avoided CO2 vs Solo Baseline)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                actualTrip: { distanceKm: 30.0, kmPerLitre: 12.0, fuelTypeCode: "PETROL_92", passengerCount: 2 },
                driverSoloDistanceKm: 25.0,
                passengers: [
                  { userId: 101, soloDistanceKm: 22.0, soloFuelTypeCode: "PETROL_92", soloKmPerLitre: 10.0 },
                  { userId: 102, soloDistanceKm: 18.0, soloFuelTypeCode: "AUTO_DIESEL", soloKmPerLitre: 14.0 }
                ]
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/carbon/avoided", host: ["{{baseUrl}}"], path: ["carbon", "avoided"] }
          }
        },
        {
          name: "POST /fair-split/calculate (Hamilton-Hare Detour Split)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                totalTripCostMinor: 48500,
                driverSoloCostMinor: 20000,
                passengers: [
                  { userId: 201, marginalDetourKm: 3.2 },
                  { userId: 202, marginalDetourKm: 5.8 },
                  { userId: 203, marginalDetourKm: 1.1 }
                ]
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/fair-split/calculate", host: ["{{baseUrl}}"], path: ["fair-split", "calculate"] }
          }
        },
        {
          name: "POST /fair-split/shapley-compare (Exact Game Split)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                numPassengers: 3,
                coalitionCosts: {
                  "0": 1500,
                  "1": 1800,
                  "2": 2100,
                  "0,1": 2400,
                  "0,2": 2600,
                  "1,2": 2900,
                  "0,1,2": 3300
                }
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/fair-split/shapley-compare", host: ["{{baseUrl}}"], path: ["fair-split", "shapley-compare"] }
          }
        },
        {
          name: "GET /wallet/balance (Balance Inquiry)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{employeeToken}}" }],
            url: { raw: "{{baseUrl}}/wallet/balance", host: ["{{baseUrl}}"], path: ["wallet", "balance"] }
          }
        },
        {
          name: "GET /wallet/transactions (Ledger History)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{employeeToken}}" }],
            url: { raw: "{{baseUrl}}/wallet/transactions", host: ["{{baseUrl}}"], path: ["wallet", "transactions"] }
          }
        },
        {
          name: "POST /wallet/topup (Corporate Top-up)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 201', () => pm.response.to.have.status(201));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{employeeToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ amountMinor: 250000, idempotencyKey: "topup-" + Date.now() }, null, 2)
            },
            url: { raw: "{{baseUrl}}/wallet/topup", host: ["{{baseUrl}}"], path: ["wallet", "topup"] }
          }
        },
        {
          name: "POST /wallet/settle-trip (Double-Entry Settlement)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{employeeToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                tripId: 9999,
                driverUserId: 1,
                passengerSplits: [
                  { userId: 2, shareMinor: 15000 },
                  { userId: 3, shareMinor: 18000 }
                ]
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/wallet/settle-trip", host: ["{{baseUrl}}"], path: ["wallet", "settle-trip"] }
          }
        }
      ]
    },
    {
      name: "Module 4 - Safety & Telematics",
      item: [
        {
          name: "GET /healthz (Liveness Probe)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: { method: "GET", header: [], url: { raw: "{{safetyUrl}}/healthz", host: ["{{safetyUrl}}"], path: ["healthz"] } }
        },
        {
          name: "GET /readyz (Readiness Probe)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: { method: "GET", header: [], url: { raw: "{{safetyUrl}}/readyz", host: ["{{safetyUrl}}"], path: ["readyz"] } }
        },
        {
          name: "POST /safety/otp/request (Generate 6-Digit OTP)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "safety.test@syscolabs.com" }, null, 2)
            },
            url: { raw: "{{safetyUrl}}/safety/otp/request", host: ["{{safetyUrl}}"], path: ["safety", "otp", "request"] }
          }
        },
        {
          name: "POST /safety/otp/request (Reject Unauthorized Domain 400)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 400', () => pm.response.to.have.status(400));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "intruder@gmail.com" }, null, 2)
            },
            url: { raw: "{{safetyUrl}}/safety/otp/request", host: ["{{safetyUrl}}"], path: ["safety", "otp", "request"] }
          }
        },
        {
          name: "POST /safety/otp/confirm (Reject Wrong Code 400)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 400', () => pm.response.to.have.status(400));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "safety.test@syscolabs.com", otp: "000000" }, null, 2)
            },
            url: { raw: "{{safetyUrl}}/safety/otp/confirm", host: ["{{safetyUrl}}"], path: ["safety", "otp", "confirm"] }
          }
        },
        {
          name: "POST /safety/ticket (30s Single-Use WS Ticket)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 201', () => pm.response.to.have.status(201));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Authorization", value: "Bearer {{employeeToken}}" }],
            url: { raw: "{{safetyUrl}}/safety/ticket", host: ["{{safetyUrl}}"], path: ["safety", "ticket"] }
          }
        },
        {
          name: "POST /safety/sos (Trigger Emergency SOS)",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test('Status is 201', () => pm.response.to.have.status(201));",
                  "const json = pm.response.json();",
                  "if (json.event && json.event.id) {",
                  "    pm.environment.set('sosEventId', json.event.id);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{employeeToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                tripId: 1,
                lat: 6.9065,
                lng: 79.851,
                note: "Vehicle tyre blowout along Galle Road"
              }, null, 2)
            },
            url: { raw: "{{safetyUrl}}/safety/sos", host: ["{{safetyUrl}}"], path: ["safety", "sos"] }
          }
        },
        {
          name: "POST /safety/sos/:id/ack (Acknowledge SOS Event)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
            url: { raw: "{{safetyUrl}}/safety/sos/{{sosEventId}}/ack", host: ["{{safetyUrl}}"], path: ["safety", "sos", "{{sosEventId}}", "ack"] }
          }
        },
        {
          name: "POST /safety/sos/:id/resolve (Resolve SOS Event)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ note: "Tow vehicle dispatched. All passengers transferred safely." }, null, 2)
            },
            url: { raw: "{{safetyUrl}}/safety/sos/{{sosEventId}}/resolve", host: ["{{safetyUrl}}"], path: ["safety", "sos", "{{sosEventId}}", "resolve"] }
          }
        }
      ]
    },
    {
      name: "Module 5 - Analytics & Privacy",
      item: [
        {
          name: "GET /health (Analytics)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: { method: "GET", header: [], url: { raw: "{{analyticsUrl}}/health", host: ["{{analyticsUrl}}"], path: ["health"] } }
        },
        {
          name: "GET /analytics/summary (ESG KPI Cards)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
            url: { raw: "{{baseUrl}}/analytics/summary", host: ["{{baseUrl}}"], path: ["analytics", "summary"] }
          }
        },
        {
          name: "GET /analytics/by-department (Department Carbon Breakdown)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
            url: { raw: "{{baseUrl}}/analytics/by-department", host: ["{{baseUrl}}"], path: ["analytics", "by-department"] }
          }
        },
        {
          name: "GET /analytics/timeseries (Daily / Monthly Trends)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
            url: {
              raw: "{{baseUrl}}/analytics/timeseries?granularity=day",
              host: ["{{baseUrl}}"],
              path: ["analytics", "timeseries"],
              query: [{ key: "granularity", value: "day" }]
            }
          }
        },
        {
          name: "GET /analytics/by-zone (Zone Flow Aggregates)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
            url: { raw: "{{baseUrl}}/analytics/by-zone", host: ["{{baseUrl}}"], path: ["analytics", "by-zone"] }
          }
        },
        {
          name: "GET /analytics/export (JSON Analytical Export)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
            url: {
              raw: "{{baseUrl}}/analytics/export?format=json",
              host: ["{{baseUrl}}"],
              path: ["analytics", "export"],
              query: [{ key: "format", value: "json" }]
            }
          }
        },
        {
          name: "GET /analytics/export (CSV Scope 3 ESG Export)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
            url: {
              raw: "{{baseUrl}}/analytics/export?format=csv",
              host: ["{{baseUrl}}"],
              path: ["analytics", "export"],
              query: [{ key: "format", value: "csv" }]
            }
          }
        },
        {
          name: "GET /gov/budget (Policymaker Privacy Budget Status)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{policymakerToken}}" }],
            url: { raw: "{{analyticsUrl}}/gov/budget", host: ["{{analyticsUrl}}"], path: ["gov", "budget"] }
          }
        },
        {
          name: "GET /gov/noise-profile (Theoretical Noise Profile Visualizer)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{policymakerToken}}" }],
            url: {
              raw: "{{analyticsUrl}}/gov/noise-profile?epsilon=0.5&sensitivity=2.0",
              host: ["{{analyticsUrl}}"],
              path: ["gov", "noise-profile"],
              query: [
                { key: "epsilon", value: "0.5" },
                { key: "sensitivity", value: "2.0" }
              ]
            }
          }
        },
        {
          name: "GET /gov/flows (Differentially Private Commute Flows)",
          event: [{ listen: "test", script: { exec: ["pm.test('Status is 200', () => pm.response.to.have.status(200));"], type: "text/javascript" } }],
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{policymakerToken}}" }],
            url: {
              raw: "{{analyticsUrl}}/gov/flows?epsilon=0.5&k=5",
              host: ["{{analyticsUrl}}"],
              path: ["gov", "flows"],
              query: [
                { key: "epsilon", value: "0.5" },
                { key: "k", value: "5" }
              ]
            }
          }
        }
      ]
    }
  ]
};

const outputPath = path.resolve(__dirname, '../postman/EcoCommute_Endpoint_Verification.postman_collection.json');
fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2), 'utf-8');
console.log('Postman collection successfully generated at: ' + outputPath);
