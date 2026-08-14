# API Design & Rate Limiting Fundamentals

This guide covers API architectural styles (REST vs GraphQL vs gRPC), pagination strategies (offset-based vs cursor-based), rate limiting algorithms, and a Node.js implementation of a distributed rate limiter.

## Contents

- [API Architectural Styles](#api-architectural-styles)
- [Pagination Strategies](#pagination-strategies)
- [Rate Limiting Algorithms](#rate-limiting-algorithms)
- [Node.js + Redis Rate Limiter Implementation](#nodejs--redis-rate-limiter-implementation)
- [API Versioning Strategies](#api-versioning-strategies)
- [API Security Essentials](#api-security-essentials)

---

## API Architectural Styles

Choosing how services talk to clients or each other depends on the use case:

| Aspect | REST (Representational State Transfer) | GraphQL | gRPC (Google Remote Procedure Call) |
| :--- | :--- | :--- | :--- |
| **Protocol** | HTTP 1.1 / HTTP 2 | HTTP 1.1 / HTTP 2 | HTTP 2 (multiplexed) |
| **Data Format**| JSON / XML | JSON | Protocol Buffers (Binary) |
| **Endpoint Structure** | Multiple Resource URLs (e.g., `/users`, `/posts`) | Single Endpoint (typically `POST /graphql`) | Service methods (e.g., `GetUser()`) |
| **Over/Under Fetching** | Yes (returns all fields by default) | No (client specifies desired fields) | No (strictly defined contract) |
| **Best For** | Public APIs, standard web/mobile client integrations | Complex client applications with variable frontend views | High-performance, low-latency microservice-to-microservice communication |

---

## Pagination Strategies

When returning lists of items (e.g., product catalogs or feeds), you cannot return all database rows at once.

### 1. Offset-Based Pagination
The API uses `limit` and `offset` query parameters. In SQL: `SELECT * FROM products LIMIT 10 OFFSET 100`.
* **Pros**: Simple to implement; allows jumping to a specific page (e.g., Page 11).
* **Cons**: 
  * **Performance Bottleneck**: To return offset 1,000,000, the database must read all 1,000,000 rows, sort them, and discard the first 999,990.
  * **Drift / Duplicates**: If a new item is added to page 1 while a user is scrolling to page 2, the user will see the last item of page 1 repeated at the top of page 2.

### 2. Cursor-Based Pagination (Recommended for infinite scroll)
The API uses a cursor pointing to the last-seen item (usually an ID or timestamp). In SQL: `SELECT * FROM products WHERE id > 456 ORDER BY id LIMIT 10`.
* **Pros**:
  * **Constant Performance**: Uses indexes directly, running in $O(\log N)$ even for deep pages.
  * **Accurate Data**: Items added/deleted don't cause duplicate items during scrolling.
* **Cons**: Cannot jump to a specific page number; sorting must be based on a unique index (like ID).

---

## Rate Limiting Algorithms

Rate limiting restricts the number of requests a user can make in a given timeframe to prevent abuse, scraping, and DDOS attacks.

### 1. Token Bucket
A bucket holds a maximum number of tokens. Every request consumes 1 token. Tokens refill at a constant rate.
* *Behavior*: Handles bursts of traffic easily while enforcing a long-term average rate.

### 2. Leaky Bucket
Requests enter a queue. The queue drains and processes requests at a constant, fixed speed.
* *Behavior*: Smooths out traffic bursts, creating a stable flow. Ideal for APIs that call databases that have strict request limits.

### 3. Sliding Window Counter (Recommended for distributed apps)
Calculates rate using: `current_window_count + previous_window_count * (remaining_time_in_current_window / window_size)`.
* *Behavior*: Prevents traffic surges at the boundaries of fixed time windows (e.g., 99 requests at 11:59:59 and 99 requests at 12:00:00). Low memory footprint compared to Sliding Window Log.

---

## Node.js + Redis Rate Limiter Implementation

Here is an Express middleware implementing a **Token Bucket** rate limiter using a Redis Lua script to guarantee atomicity (preventing race conditions in a clustered app server environment):

```javascript
// Install: npm install express ioredis
const express = require('express');
const Redis = require('ioredis');

const app = express();
const redis = new Redis({ host: '127.0.0.1', port: 6379 });

// Lua script to make token-bucket evaluation atomic in Redis
const rateLimiterScript = `
  local key = KEYS[1]
  local max_tokens = tonumber(ARGV[1])
  local refill_rate = tonumber(ARGV[2]) -- tokens per millisecond
  local now = tonumber(ARGV[3]) -- current time in ms

  -- Retrieve bucket state
  local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
  local tokens = tonumber(bucket[1])
  local last_refill = tonumber(bucket[2])

  if not tokens then
    -- Initialize bucket
    tokens = max_tokens
    last_refill = now
  else
    -- Refill tokens based on elapsed time
    local elapsed = now - last_refill
    tokens = math.min(max_tokens, tokens + (elapsed * refill_rate))
    last_refill = now
  end

  -- Evaluate request
  if tokens >= 1 then
    tokens = tokens - 1
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
    redis.call('PEXPIRE', key, 86400000) -- expire key in 1 day
    return 1 -- Request Allowed
  else
    return 0 -- Request Blocked
  end
`;

async function rateLimiterMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'] || req.ip; // Limit by User ID or IP
  const redisKey = `rate_limit:${userId}`;

  const maxTokens = 10;
  const refillIntervalMs = 60000; // 1 minute
  const refillRate = maxTokens / refillIntervalMs; // tokens per ms
  const now = Date.now();

  try {
    // Run Lua script atomically in Redis
    const allowed = await redis.eval(
      rateLimiterScript, 
      1, 
      redisKey, 
      maxTokens, 
      refillRate, 
      now
    );

    if (allowed === 1) {
      next();
    } else {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.'
      });
    }
  } catch (err) {
    console.error('Rate Limiter Error:', err);
    next(); // Fail-open: don't block users if Redis fails
  }
}

// Apply middleware to API routes
app.get('/api/resource', rateLimiterMiddleware, (req, res) => {
  res.json({ data: 'Sensitive API Resource' });
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

---

## API Versioning Strategies

As systems evolve, you must make breaking changes to APIs without breaking existing clients. Here are the three primary strategies:

### 1. URI Versioning (Most Common)
Version identifier is part of the URL path.
* **Format**: `GET /api/v1/users`
* **Pros**: Simple, highly visible, easy to cache at reverse proxy level (Nginx/CDN).
* **Cons**: Moves resource URIs away from their semantic path representation.

### 2. Query Parameter Versioning
Version identifier is passed in the query string.
* **Format**: `GET /api/users?version=1`
* **Pros**: Clean path names; default fallbacks are easy to set up.
* **Cons**: Harder to cache properly since query params can be ignored by some routing/caching layers.

### 3. Header Versioning (Media Type / Accept Header)
Version identifier is passed as a custom request header or inside the standard `Accept` header.
* **Format**: 
  * Custom header: `X-API-Version: 1`
  * Accept header: `Accept: application/vnd.myapi.v1+json`
* **Pros**: Keeps URLs clean; follows proper REST principles (content negotiation).
* **Cons**: Harder to test in browser search bars; complex caching rules.

---

## API Security Essentials

A production-grade API must enforce security rules at the entry gate:

1. **HTTPS/TLS**: Encrypt all data in transit to prevent Man-in-the-Middle (MITM) attacks.
2. **CORS (Cross-Origin Resource Sharing)**: Restrict which external domains/websites can access your API.
3. **Authentication & Authorization**:
   * *AuthN (Who are you?)*: JWT or session cookies verification.
   * *AuthZ (What are you allowed to do?)*: Role-Based Access Control (RBAC) (e.g. check if `user.role === 'admin'`).
4. **Input Validation**: Sanitize and validate all incoming request bodies and query parameters to prevent SQL injection or Cross-Site Scripting (XSS).

