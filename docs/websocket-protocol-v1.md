# Real-Time WebSocket Protocol Specification (v1.0)
### Module 4: Safety Layer + Real-time Tracking & Anomaly Detection
**Author:** Amaraweera MTP (244015X)  
**Standard:** RFC 6455 Custom WebSocket Architecture  
**Service Endpoint:** `wss://api.example.lk/ws` (proxied to `realtime:4400`)

---

## 1. Authentication & Handshake

WebSockets do not natively support custom HTTP headers in browser and React Native WebSocket APIs. To avoid leaking bearer tokens into standard access logs, two authentication mechanisms are supported:

### Option A: `Sec-WebSocket-Protocol` Header (Recommended)
Client passes the JWT within the subprotocol negotiation:
```http
GET /ws HTTP/1.1
Host: api.example.lk
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Sec-WebSocket-Protocol: access_token, bearer.<JWT_TOKEN>
```
The server validates the JWT signature and expiration during the HTTP `upgrade` event before calling `wss.handleUpgrade`.

### Option B: Ephemeral Single-Use Ticket (Fallback)
1. Client requests a ticket via REST API:
   `POST /api/safety/ticket` (authenticated via `Authorization: Bearer <token>`)
   Response: `{ "ticket": "uuid4", "expiresIn": 30 }`
2. Client connects with ticket in query string:
   `GET /ws?ticket=<uuid4> HTTP/1.1`
3. Server redeems and deletes the ticket immediately upon connection.

### Rejection Codes on Handshake
- Missing or invalid JWT / ticket: HTTP `401 Unauthorized`
- Expired token: HTTP `401 Unauthorized`

---

## 2. Room Model & Permissions
Connections are organized into isolated in-memory pub/sub rooms:
- **`trip:{tripId}`**: Active driver and verified riders of the trip.
- **`company-admins:{companyId}`**: Corporate admins and safety coordinators receiving broadcast alerts across all active company shuttles and carpools.

### Permission Rules
- A user can only `join` room `trip:{tripId}` if they exist in `core.trip_participants` for that trip, or possess `role='admin'` for the trip's company.
- Non-authorized subscription attempts receive close code `4403 Forbidden`.

---

## 3. Client-to-Server Message Schemas (`v: 1`)

All messages MUST be valid JSON with `v: 1` and maximum payload size of **2048 bytes**. Rate limit is strictly enforced at **≤ 2 location messages/sec** per socket.

### 3.1 Join Trip Room
```json
{
  "v": 1,
  "type": "join",
  "tripId": 1
}
```

### 3.2 GPS Location Ingestion (Driver / Rider)
```json
{
  "v": 1,
  "type": "location",
  "tripId": 1,
  "lat": 6.9042,
  "lng": 79.9547,
  "speed": 11.4,
  "heading": 260.0,
  "accuracy": 4.2,
  "recordedAt": "2026-10-15T08:30:00.000Z"
}
```
*Filtering Rule:* Points with `accuracy > 100.0` meters or `recordedAt` skew > 5 minutes are discarded from anomaly calculations.

### 3.3 Heartbeat Ping
```json
{
  "v": 1,
  "type": "ping"
}
```

### 3.4 Manual SOS Trigger
```json
{
  "v": 1,
  "type": "sos",
  "tripId": 1,
  "lat": 6.9042,
  "lng": 79.9547,
  "note": "Emergency assistance requested"
}
```

---

## 4. Server-to-Client Message Schemas

### 4.1 Room Joined Acknowledgment
Sent immediately upon joining, includes the last known positions of all trip participants:
```json
{
  "v": 1,
  "type": "joined",
  "tripId": 1,
  "participants": [
    {
      "userId": 2,
      "role": "driver",
      "lastLocation": {
        "lat": 6.9041,
        "lng": 79.9545,
        "speed": 11.4,
        "heading": 260.0,
        "recordedAt": "2026-10-15T08:29:58.000Z"
      }
    }
  ]
}
```

### 4.2 Location Broadcast
Relayed to all participants in `trip:{tripId}` within ≤ 500ms:
```json
{
  "v": 1,
  "type": "location",
  "tripId": 1,
  "userId": 2,
  "role": "driver",
  "lat": 6.9042,
  "lng": 79.9547,
  "speed": 11.4,
  "heading": 260.0,
  "accuracy": 4.2,
  "recordedAt": "2026-10-15T08:30:00.000Z"
}
```

### 4.3 Deviation Alert (Anomaly Escalation)
Broadcast when the vehicle deviates from `safety.route_boundaries`:
```json
{
  "v": 1,
  "type": "deviation",
  "tripId": 1,
  "level": "warning",
  "distanceM": 320.5,
  "mildThresholdM": 250,
  "severeThresholdM": 1000,
  "consecutivePoints": 3,
  "timestamp": "2026-10-15T08:30:03.000Z"
}
```

### 4.4 Emergency SOS Notification
Broadcast to trip room and `company-admins`:
```json
{
  "v": 1,
  "type": "sos",
  "eventId": 14,
  "tripId": 1,
  "userId": 5,
  "trigger": "manual",
  "lat": 6.9042,
  "lng": 79.9547,
  "timestamp": "2026-10-15T08:30:15.000Z",
  "status": "open"
}
```

### 4.5 Error Notification
```json
{
  "v": 1,
  "type": "error",
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Maximum 2 location reports per second allowed."
}
```

---

## 5. Heartbeat & Disconnection Lifecycle
- **Server Heartbeat:** The server sends a WebSocket ping frame every **30 seconds**.
- Sockets failing to respond with pong within **2 consecutive cycles** (60s) are terminated with code `1006`.
- **Client Reconnection Strategy:** Exponential backoff with jitter:
  $$t_{\text{backoff}} = \min(30\text{s}, 1\text{s} \times 2^{\text{attempt}}) \pm \text{random}(0, 1\text{s})$$

---

## 6. RFC 6455 Custom WebSocket Close Codes
| Code | Reason | Meaning |
|---|---|---|
| `1000` | Normal Closure | Trip ended or client navigated away |
| `1001` | Going Away | Server restarting / maintenance |
| `4401` | Unauthorized | Missing or expired authentication token |
| `4403` | Forbidden | User not authorized for this trip or company |
| `4404` | Trip Not Found | Invalid trip ID |
| `4429` | Rate Limited | Message frequency exceeded safety caps |
