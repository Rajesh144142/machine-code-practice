# WebSockets & Real-Time Communication

This guide covers real-time communication protocols (WebSockets vs SSE vs Long Polling), the stateful scaling challenge of WebSockets, scaling using Redis Pub/Sub, heartbeats (Ping-Pong), and a Node.js `ws` server implementation.

## Contents

- [Real-Time Protocols Comparison](#real-time-protocols-comparison)
- [The Stateful Scaling Challenge](#the-stateful-scaling-challenge)
- [Connection Heartbeats (Ping-Pong)](#connection-heartbeats-ping-pong)
- [Node.js WebSocket Server Implementation](#nodejs-websocket-server-implementation)
- [WebSocket Handshake Authentication](#websocket-handshake-authentication)

---

## Real-Time Protocols Comparison

Building features like chat, live feeds, or stock dashboards requires pushing data from server to client instantly.

| Feature | WebSockets | Server-Sent Events (SSE) | HTTP Long Polling |
| :--- | :--- | :--- | :--- |
| **Direction** | Bi-directional (Client <-> Server) | Uni-directional (Server -> Client) | Bi-directional (simulated) |
| **Protocol** | custom `ws://` / `wss://` (TCP) | standard HTTP | standard HTTP |
| **Headers Overhead** | Tiny (after handshake) | Tiny | Heavy (each poll sends full headers) |
| **Reconnection** | Must be coded manually | Automatic (by browser) | Handled by new request loop |
| **Use Case** | Real-time gaming, multiplayer editors, interactive chat apps | Live sports updates, news tickers, logging consoles | Legacy fallback systems |

---

## The Stateful Scaling Challenge

Traditional HTTP servers are **stateless**; any request from a client can be routed by a Load Balancer to *any* application server instance.

WebSockets are **stateful**; the client maintains an active, open TCP connection with a *specific* server instance.

```text
[Client A] <====== WebSocket Connection ======> [Server 1]
[Client B] <====== WebSocket Connection ======> [Server 2]
```

### The Problem: Multi-Instance Broadcasts
If Client A wants to send a chat message to Client B, Client A's message travels up to `Server 1`. But Client B is connected to `Server 2`. `Server 1` does not know where Client B is, nor does it have Client B's TCP connection object.

### The Solution: Redis Pub/Sub Adapter
We connect all WebSocket servers to a central **Redis Pub/Sub channel**.
1. Client A sends a message to `Server 1` addressed to Client B.
2. `Server 1` publishes the message to Redis: `redis.publish('chat-room', message)`.
3. All servers (`Server 1` & `Server 2`) are subscribed to the Redis channel `chat-room`.
4. When `Server 2` receives the broadcast from Redis, it checks if Client B is connected locally. Since it is, it forwards the message to Client B via its active WebSocket.

```text
[Client A] ---> [Server 1] ---> (Publish) ---> [Redis Pub/Sub]
                                                    |
[Client B] <--- [Server 2] <--- (Subscribe) <-------+
```

---

## Connection Heartbeats (Ping-Pong)

When a mobile user drives into a tunnel or loses cell service suddenly, the WebSocket connection breaks. However, the server does not immediately notice and will keep the connection socket open, causing a **memory leak**.

To clean up dead sockets:
1. The server regularly sends a **Ping** frame to all connected clients (e.g., every 30 seconds).
2. The client must respond with a **Pong** frame automatically.
3. If a client fails to reply within the timeout limit, the server marks the connection as dead, terminates the socket, and cleans up memory.

---

## Node.js WebSocket Server Implementation

Here is a Node.js WebSocket server implementation using the popular `ws` library, incorporating connection tracking, Redis Pub/Sub integration, and the Ping-Pong heartbeat mechanism:

```javascript
// Install: npm install ws ioredis
const { WebSocketServer } = require('ws');
const Redis = require('ioredis');

const wss = new WebSocketServer({ port: 8080 });

// Redis connections for Pub/Sub
const pub = new Redis({ host: '127.0.0.1', port: 6379 });
const sub = new Redis({ host: '127.0.0.1', port: 6379 });

// Local map of userId -> WebSocket connection
const activeClients = new Map();

// 1. Subscribe to Redis Channel for cross-instance broadcasts
sub.subscribe('ws-broadcast');
sub.on('message', (channel, message) => {
  const { recipientId, data } = JSON.parse(message);
  
  // If the target recipient is connected to this specific server, send the data
  const clientSocket = activeClients.get(recipientId);
  if (clientSocket && clientSocket.readyState === clientSocket.OPEN) {
    clientSocket.send(JSON.stringify(data));
  }
});

wss.on('connection', (ws, req) => {
  // Extract userId from URL query, e.g., ws://localhost:8080?userId=123
  const urlParams = new URLSearchParams(req.url.split('?')[1]);
  const userId = urlParams.get('userId');

  if (!userId) {
    ws.close(4001, 'UserId required');
    return;
  }

  ws.isAlive = true; // For heartbeat tracking
  activeClients.set(userId, ws);
  console.log(`User ${userId} connected`);

  // Setup client pong handler
  ws.on('pong', () => {
    ws.isAlive = true; // Mark as responsive
  });

  ws.on('message', async (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      // Example target: { recipientId: "456", text: "Hello" }
      const { recipientId, text } = parsedMessage;

      const payload = {
        recipientId,
        data: { senderId: userId, text, timestamp: Date.now() }
      };

      // Publish to Redis so all servers can pick up and distribute
      await pub.publish('ws-broadcast', JSON.stringify(payload));
    } catch (err) {
      console.error('Invalid message format:', err);
    }
  });

  ws.on('close', () => {
    activeClients.delete(userId);
    console.log(`User ${userId} disconnected`);
  });
});

// 2. Heartbeat Ping-Pong Interval (runs every 30 seconds)
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('Terminating dead connection...');
      return ws.terminate(); // Clean up dead socket
    }

    ws.isAlive = false; // Reset to false
    ws.ping(); // Send ping frame, client browser automatically returns pong
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

console.log('WebSocket Server running on port 8080');
```

---

## WebSocket Handshake Authentication

Authentication for WebSockets is unique. The browser client-side `new WebSocket(url)` API **does not support sending custom headers** (like `Authorization: Bearer <JWT>`).

Therefore, authentication is handled in one of two ways during the initial HTTP Upgrade request (the "handshake"):

### 1. Token via Query Parameter (Fast & Common)
The client sends the JWT in the query string:
`const ws = new WebSocket("ws://localhost:8080?token=eyJhbGciOi...")`

**Security Concern**: Query parameters are logged in web server access logs. Keep JWT expiration times very short.

### 2. Token via Cookies (Most Secure)
If the WebSocket server runs on the same root domain as the web API, the browser automatically sends cookies along with the handshake HTTP upgrade request.
* **Why it's secure**: Using `httpOnly` and `Secure` cookies prevents JavaScript from reading/stealing the token and keeps it hidden from logs.

### Handshake Authentication Implementation Example (Node.js)
Here is how to intercept the handshake and verify a JWT before allowing the connection:

```javascript
const http = require('http');
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');

const server = http.createServer();
const wss = new WebSocketServer({ noServer: true }); // Manual connection upgrade

const JWT_SECRET = 'my_secret_key';

// Intercept HTTP upgrade request
server.on('upgrade', (request, socket, head) => {
  // Extract token from query parameters: ?token=<JWT>
  const url = new URL(request.url, `http://${request.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  // Verify JWT
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    // Authenticated! Hand over the socket to the WebSocket Server
    wss.handleUpgrade(request, socket, head, (ws) => {
      // Pass the decoded user info to the connection handler
      ws.user = decoded; 
      wss.emit('connection', ws, request);
    });
  });
});

wss.on('connection', (ws) => {
  console.log(`User ${ws.user.userId} authenticated and connected!`);
  ws.send(`Hello, ${ws.user.email}`);
});

server.listen(8080);
```

