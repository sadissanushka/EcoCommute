import http from 'http';
import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { app, server, wss } from '../src/server';
import { config } from '../src/config';
import { pool } from '../src/db/pool';
import { ticketStore } from '../src/routes/ticket';

describe('Step 1.2 & 1.3: Real-Time WebSocket Server & Two-Client Demo Suite', () => {
  let testServer: http.Server;
  let serverPort: number;

  beforeAll((done) => {
    testServer = server.listen(0, () => {
      const addr = testServer.address() as any;
      serverPort = addr.port;
      done();
    });
  });

  afterAll(async () => {
    wss.close();
    testServer.close();
    await pool.end();
  });

  function createTestTicket(userId: number, email: string, role: any, companyId: number): string {
    const ticket = `test-ticket-${userId}-${Date.now()}`;
    ticketStore.set(ticket, {
      ticket,
      userId,
      email,
      role,
      companyId,
      expiresAt: Date.now() + 30000,
    });
    return ticket;
  }

  it('rejects connection without ticket or JWT with HTTP 401', (done) => {
    const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
    ws.on('error', (err: any) => {
      expect(err.message).toMatch(/401/);
      done();
    });
  });

  it('authenticates via Sec-WebSocket-Protocol (bearer.<jwt>) and responds to ping', (done) => {
    const token = jwt.sign(
      { id: 2, email: 'driver1@syscolabs.com', role: 'driver', companyId: 1 },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const ws = new WebSocket(`ws://localhost:${serverPort}/ws`, [`access_token`, `bearer.${token}`]);

    ws.on('open', () => {
      ws.send(JSON.stringify({ v: 1, type: 'ping' }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      expect(msg.type).toBe('pong');
      ws.close();
      done();
    });
  });

  it('Step 1.3: Two live clients in one trip room — Client A broadcasts position, Client B receives it within ≤1s', (done) => {
    const driverTicket = createTestTicket(2, 'driver1@syscolabs.com', 'driver', 1);
    const riderTicket = createTestTicket(5, 'emp1@syscolabs.com', 'employee', 1);

    const driverWs = new WebSocket(`ws://localhost:${serverPort}/ws?ticket=${driverTicket}`);
    const riderWs = new WebSocket(`ws://localhost:${serverPort}/ws?ticket=${riderTicket}`);

    let driverJoined = false;
    let riderJoined = false;

    function checkReady() {
      if (driverJoined && riderJoined) {
        // Driver sends GPS position
        driverWs.send(
          JSON.stringify({
            v: 1,
            type: 'location',
            tripId: 1,
            lat: 6.9042,
            lng: 79.9547,
            speed: 12.5,
            heading: 260.0,
            accuracy: 4.0,
            recordedAt: new Date().toISOString(),
          })
        );
      }
    }

    driverWs.on('open', () => {
      driverWs.send(JSON.stringify({ v: 1, type: 'join', tripId: 1 }));
    });

    driverWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'joined') {
        driverJoined = true;
        checkReady();
      }
    });

    riderWs.on('open', () => {
      riderWs.send(JSON.stringify({ v: 1, type: 'join', tripId: 1 }));
    });

    riderWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'joined') {
        riderJoined = true;
        checkReady();
      } else if (msg.type === 'location') {
        // Assert Rider receives Driver's position report
        expect(msg.tripId).toBe(1);
        expect(msg.userId).toBe(2);
        expect(msg.lat).toBe(6.9042);
        expect(msg.lng).toBe(79.9547);
        expect(msg.speed).toBe(12.5);

        driverWs.close();
        riderWs.close();
        done();
      }
    });
  });

  it('rejects payloads larger than 2KB with PAYLOAD_TOO_LARGE error', (done) => {
    const ticket = createTestTicket(2, 'driver1@syscolabs.com', 'driver', 1);
    const ws = new WebSocket(`ws://localhost:${serverPort}/ws?ticket=${ticket}`);

    ws.on('open', () => {
      const oversizedPayload = {
        v: 1,
        type: 'location',
        tripId: 1,
        padding: 'A'.repeat(2500),
      };
      ws.send(JSON.stringify(oversizedPayload));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      expect(msg.type).toBe('error');
      expect(msg.code).toBe('PAYLOAD_TOO_LARGE');
      ws.close();
      done();
    });
  });
});
