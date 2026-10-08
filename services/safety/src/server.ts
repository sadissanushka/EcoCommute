import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import url from 'url';
import { config } from './config';
import { healthRouter } from './routes/health';
import { ticketRouter, redeemTicket, verifyJwtToken } from './routes/ticket';
import { AuthUser } from './types';
import { handleWebSocketMessage } from './websocket/handler';
import { roomManager } from './websocket/rooms';

export const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/', healthRouter);
app.use('/safety', ticketRouter);

export const server = http.createServer(app);

// RFC 6455 WebSocket Server
export const wss = new WebSocketServer({ noServer: true });

// Sockets and Room Tracking
interface AuthenticatedSocket extends WebSocket {
  isAlive: boolean;
  user: AuthUser;
  rooms: Set<string>;
  messageCount: number;
  lastMessageReset: number;
}

export const rooms = new Map<string, Set<AuthenticatedSocket>>();

export function broadcastToRoom(room: string, payload: any, excludeSocket?: WebSocket) {
  const sockets = rooms.get(room);
  if (!sockets) return;
  const msg = JSON.stringify(payload);
  for (const client of sockets) {
    if (client !== excludeSocket && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

// Handshake verification during HTTP Upgrade
server.on('upgrade', (request, socket, head) => {
  const parsedUrl = url.parse(request.url || '', true);
  const pathname = parsedUrl.pathname;

  if (pathname !== '/ws') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }

  let user: AuthUser | null = null;

  // 1. Check ticket in query parameter
  const ticketParam = parsedUrl.query.ticket as string | undefined;
  if (ticketParam) {
    const ticketData = redeemTicket(ticketParam);
    if (ticketData) {
      user = {
        id: ticketData.userId,
        email: ticketData.email,
        role: ticketData.role,
        companyId: ticketData.companyId,
      };
    }
  }

  // 2. Fallback: Check Sec-WebSocket-Protocol header (access_token, bearer.<jwt>)
  if (!user) {
    const protocols = request.headers['sec-websocket-protocol'];
    if (protocols) {
      const parts = protocols.split(',').map((p) => p.trim());
      for (const part of parts) {
        if (part.startsWith('bearer.')) {
          const token = part.substring(7);
          user = verifyJwtToken(token);
          if (user) break;
        }
      }
    }
  }

  if (!user) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    const authWs = ws as AuthenticatedSocket;
    authWs.isAlive = true;
    authWs.user = user!;
    authWs.rooms = new Set();
    authWs.messageCount = 0;
    authWs.lastMessageReset = Date.now();

    wss.emit('connection', authWs, request);
  });
});

// WebSocket Connection Lifecycle
wss.on('connection', (ws: AuthenticatedSocket) => {
  // Setup heartbeat ping-pong
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (data: Buffer | string) => {
    // 1. Enforce payload size limit
    if (Buffer.byteLength(data.toString()) > config.maxPayloadBytes) {
      ws.send(JSON.stringify({ v: 1, type: 'error', code: 'PAYLOAD_TOO_LARGE', message: 'Payload exceeded 2KB limit' }));
      return;
    }

    // 2. Enforce rate limiting
    const now = Date.now();
    if (now - ws.lastMessageReset >= 1000) {
      ws.messageCount = 0;
      ws.lastMessageReset = now;
    }
    ws.messageCount++;
    if (ws.messageCount > config.rateLimitPerSec * 2) {
      ws.send(JSON.stringify({ v: 1, type: 'error', code: 'RATE_LIMIT_EXCEEDED', message: 'Maximum 2 location reports per second allowed' }));
      return;
    }

    handleWebSocketMessage(ws as any, data);
  });

  ws.on('close', () => {
    roomManager.removeSocketFromAllRooms(ws as any);
  });
});


// Periodic Heartbeat check
const heartbeatInterval = setInterval(() => {
  for (const client of wss.clients) {
    const authWs = client as AuthenticatedSocket;
    if (authWs.isAlive === false) {
      authWs.terminate();
      continue;
    }
    authWs.isAlive = false;
    authWs.ping();
  }
}, config.heartbeatIntervalMs).unref();
