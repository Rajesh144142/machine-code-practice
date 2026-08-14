# Caching & Redis Fundamentals

This guide covers caching strategies, cache eviction policies, common distributed cache issues (avalanche, penetration, stampede), core Redis commands, and JavaScript integration.

## Contents

- [What is Caching?](#what-is-caching)
- [Caching Strategies](#caching-strategies)
- [Cache Eviction Policies](#cache-eviction-policies)
- [Common Distributed Cache Problems](#common-distributed-cache-problems)
- [Redis Data Structures & Commands](#redis-data-structures--commands)
- [JavaScript Integration Example](#javascript-integration-example)
- [Cache Invalidation & Consistency](#cache-invalidation--consistency)
  - [1. Types of Cache Invalidation](#1-types-of-cache-invalidation)
  - [2. When to Use What: Decision Matrix](#2-when-to-use-what-decision-matrix)
  - [3. JavaScript Implementation Examples](#3-javascript-implementation-examples)

---

## What is Caching?

**Caching** is the process of storing copies of data in a high-speed storage layer (usually RAM) so that future requests for that data can be served faster than fetching it from the primary database or API.

* **Cache Hit**: Data is found in the cache. Very fast response (~1ms).
* **Cache Miss**: Data is not found in the cache. The application must fetch it from the database (slow, ~50-200ms) and write it to the cache for future requests.
* **Hit Ratio**: `Cache Hits / Total Requests`. A healthy production cache should aim for a hit ratio of >80%.

---

## Caching Strategies

How does data get into and out of the cache? Different architectures require different strategies:

### 1. Cache-Aside (Lazy Loading) - Most Common
The application queries the cache. If it misses, it queries the database, returns the data to the client, and writes the data to the cache.
* **Pros**: Simple; cache only contains requested data; database or cache failures aren't fatal.
* **Cons**: Three network hops on a cache miss; data can become stale if updated in the DB but not invalidated in the cache.

```text
[Client] ---> [App Server] ---> (1. Check Cache) ---> [Cache] (Miss!)
                   |
                   +----------> (2. Query DB) -------> [Database]
                   |
                   +----------> (3. Write Cache) ----> [Cache]
```

### 2. Write-Through
The application writes data to the cache, and the cache *immediately* writes it to the database. Both must succeed before returning.
* **Pros**: Cache is never stale; read hits are extremely fast.
* **Cons**: Write latency is high (waits for both database and cache writes).

### 3. Write-Back (Write-Behind)
The application writes data to the cache. The cache immediately returns success and queues up a background process to write to the database asynchronously.
* **Pros**: High-speed write performance (no waiting for DB).
* **Cons**: Risk of data loss if the cache server crashes before writing to the database.

---

## Cache Eviction Policies

Since memory (RAM) is expensive and limited, caches must delete old data when they run out of space.

* **LRU (Least Recently Used)**: Discards the items that haven't been accessed for the longest time. (Standard default for Redis).
* **LFU (Least Frequently Used)**: Tracks how often an item is accessed. Discards items with the lowest access counts.
* **FIFO (First In First Out)**: Evicts the oldest items first, regardless of how often they are used.
* **TTL (Time To Live)**: Keys are automatically deleted after a specified duration (e.g., expire in 1 hour).

---

## Common Distributed Cache Problems

When running a cache at high scale (millions of users), you will run into these classic interview problems:

### 1. Cache Penetration
* **The Problem**: A request is made for a key that exists in neither the cache nor the database (e.g., `/user/-9999` or hacker brute-forcing). Every request misses the cache and hits the database, potentially overloading it.
* **Solutions**:
  * **Cache Null Values**: If the DB query returns empty, cache a `null` value with a short TTL (e.g., 5 mins) so subsequent requests don't hit the DB.
  * **Bloom Filter**: A space-efficient data structure placed in front of the cache that can tell you with 100% certainty if an item *does not* exist in the database.

### 2. Cache Avalanche
* **The Problem**: Many cached keys expire at the exact same time, or the cache server crashes. Suddenly, all traffic hits the database simultaneously, causing a crash.
* **Solutions**:
  * **Randomize TTLs (Jitter)**: Add a random variance to expiration times (e.g., `expireTime = baseTTL + randomOffset(0-5 mins)`) so keys expire evenly over time.
  * **High Availability**: Run a Redis cluster with master/replica setup to prevent complete cache failure.

### 3. Cache Breakdown (Cache Stampede)
* **The Problem**: A highly popular key (e.g., "homepage-news") expires. Millions of concurrent requests miss the cache at the exact same millisecond and attempt to query the DB and write back to the cache.
* **Solutions**:
  * **Distributed Mutex (Locking)**: The first request that misses acquires a lock (using Redis `SET NX`). Only this request queries the database and updates the cache. Other requests wait or retry.
  * **Soft Expiration / Background Update**: Store the actual expiry timestamp inside the cache value. Before it expires, a background task notices and updates the cache proactively.

---

## Redis Data Structures & Commands

Redis is not just a key-value store; it supports rich data structures.

| Structure | Main Commands | Use Case |
| :--- | :--- | :--- |
| **String** | `SET`, `GET`, `INCR`, `DECR` | Simple key-value caching, session storage, counters |
| **Hash** | `HSET`, `HGET`, `HGETALL` | Storing objects (e.g., user profiles with multiple fields) |
| **List** | `LPUSH`, `RPOP`, `LRange` | Basic FIFO message queues, double-ended queues |
| **Set** | `SADD`, `SISMEMBER`, `SINTER` | Unordered unique items, tags, finding common friends |
| **Sorted Set** | `ZADD`, `ZRANGE`, `ZREVRANGE` | Leaderboards, rate-limiters, sliding-window logs |

---

## JavaScript Integration Example

Here is how to implement the **Cache-Aside (Lazy Loading)** pattern using the `ioredis` library in Node.js:

```javascript
// Install: npm install ioredis pg
const Redis = require('ioredis');
const { Client } = require('pg'); // PostgreSQL client

const redis = new Redis({ host: '127.0.0.1', port: 6379 });
const dbClient = new Client({ connectionString: 'postgresql://...' });

async function getUserProfile(userId) {
  const cacheKey = `user:${userId}:profile`;

  try {
    // 1. Try fetching from Redis Cache
    const cachedData = await redis.get(cacheKey);
    
    if (cachedData) {
      console.log('Cache Hit!');
      return JSON.parse(cachedData);
    }
    
    console.log('Cache Miss. Fetching from database...');
    
    // 2. Fetch from primary PostgreSQL Database
    const res = await dbClient.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = res.rows[0];
    
    if (!user) {
      // Prevent Cache Penetration: Cache null/empty for 5 mins
      await redis.set(cacheKey, JSON.stringify({}), 'EX', 300);
      return null;
    }

    // 3. Write data to cache with a TTL (e.g., 1 hour / 3600 seconds)
    // Add jitter (e.g., 0 to 300 seconds) to prevent Cache Avalanche
    const jitter = Math.floor(Math.random() * 300);
    const ttl = 3600 + jitter;
    
    await redis.set(cacheKey, JSON.stringify(user), 'EX', ttl);
    
    return user;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    // Failover: If cache dies, bypass to DB so system stays functional
    const res = await dbClient.query('SELECT * FROM users WHERE id = $1', [userId]);
    return res.rows[0];
  }
}
```

---

## Cache Invalidation & Consistency

One of the hardest problems in software engineering is **Cache Invalidation** (keeping the cache in sync with the database). When data changes in the database, we must ensure the cache does not continue to serve stale data.

---

### 1. Types of Cache Invalidation

There are four primary strategies for cache invalidation:

#### A. Passive Invalidation (Time-To-Live / TTL)
Cache keys automatically expire after a set duration.
* **When to use**: Data is read-heavy but updates infrequently, and the business can tolerate slightly stale data (e.g., weather data, product catalog listings, static configurations).
* **Pros**: Simple, zero application complexity during database updates.
* **Cons**: Data remains stale for the duration of the TTL.

#### B. Active Invalidation (Eviction-on-Write / Cache-Aside Deletion) - Recommended
The application explicitly **deletes** the cache key immediately after performing a database write. The next read operation experiences a cache miss and rebuilds the cache with the fresh value.
* **When to use**: Dynamic data with strict consistency requirements (e.g., user profiles, account permissions, document contents).
* **Pros**: Highly consistent, avoids update race conditions.
* **Cons**: Requires explicit application logic in all database write routes.

#### C. Write-Through / Update Invalidation (Update-on-Write)
The application **updates** the cache value directly when writing to the database.
* **When to use**: Extreme read-heavy items where cache miss overhead is too expensive, and we cannot afford even a single cache miss.
* **Pros**: High cache hit ratio (100% hits if keys are preloaded).
* **Cons**: Vulnerable to the update race condition (Network packets arriving out of order can leave the cache permanently stale).

#### D. Event-Driven Invalidation (CDC / Pub-Sub)
When the database is updated directly (e.g., by an admin script, external worker, or legacy system), database triggers or a **Change Data Capture (CDC)** tool (like Debezium) publish an update event. An invalidation service listens to this event and evicts the cache key.
* **When to use**: Microservices where database updates occur outside the API server, or when multiple services share the cache.
* **Pros**: Decouples application write logic from cache maintenance.
* **Cons**: Event latency (takes a few milliseconds for the event to propagate, creating a tiny window of staleness).

---

### 2. When to Use What: Decision Matrix

| Strategy | Consistency | Write Overhead | Read Performance | Complexity | Best Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TTL (Passive)** | Low/Medium | None | Max (100% hit rate) | Very Low | Static configs, weather, reports |
| **Eviction (Active)**| High | Medium | High (1 miss on update) | Medium | User profiles, permissions |
| **Write-Through** | Medium/High | High | Max (100% hit rate) | High | Critical real-time dashboards |
| **Event-Driven** | High (Eventual) | Low | High | Very High | Distributed DBs, shared caches |

---

### 3. JavaScript Implementation Examples (using `ioredis`)

#### A. Passive Invalidation (TTL)
```javascript
// Setting a key with a TTL of 1 hour (3600 seconds)
async function cacheWithTtl(key, data) {
  // EX means set expiry in seconds
  await redis.set(key, JSON.stringify(data), 'EX', 3600);
}
```

#### B. Active Invalidation (Evict-on-Write)
```javascript
async function updateProductDetails(productId, newData) {
  const cacheKey = `product:${productId}:details`;

  // 1. Update the database first
  await dbClient.query('UPDATE products SET price = $1 WHERE id = $2', [newData.price, productId]);

  // 2. EVICT (Delete) the cache key immediately
  // Deleting is idempotent and safe from out-of-order race conditions
  await redis.del(cacheKey);
  console.log('Cache evicted for key:', cacheKey);
}
```

#### C. Write-Through / Update-on-Write (with Locking to prevent race conditions)
If we must *update* the cache instead of deleting it, we must use a distributed lock (mutex) to prevent out-of-order race conditions:
```javascript
async function updateProductWriteThrough(productId, newData) {
  const cacheKey = `product:${productId}:details`;
  const lockKey = `lock:product:${productId}`;

  // Acquire a lock in Redis for 5 seconds to ensure atomic cache updates
  const hasLock = await redis.set(lockKey, 'locked', 'EX', 5, 'NX');
  if (!hasLock) {
    throw new Error('Update in progress. Please retry.');
  }

  try {
    // 1. Write to DB
    await dbClient.query('UPDATE products SET price = $1 WHERE id = $2', [newData.price, productId]);

    // 2. Update the cache directly
    await redis.set(cacheKey, JSON.stringify(newData), 'EX', 3600);
  } finally {
    // 3. Always release the lock
    await redis.del(lockKey);
  }
}
```

#### D. Event-Driven Invalidation (Pub/Sub Consumer)
Here is a background worker listening to a database update channel and evicting keys:
```javascript
const subscriber = new Redis({ host: '127.0.0.1', port: 6379 });

// Subscribe to database change events (e.g. published by a DB trigger/listener)
subscriber.subscribe('db-changes');

subscriber.on('message', async (channel, message) => {
  const event = JSON.parse(message);
  // Example event: { table: "users", action: "UPDATE", id: "123" }
  
  if (event.table === 'users' && event.action === 'UPDATE') {
    const cacheKey = `user:${event.id}:profile`;
    await redis.del(cacheKey); // Evict cache key
    console.log(`[Event-Driven] Evicted cache key: ${cacheKey}`);
  }
});
```

---

### The Question: Delete Cache vs. Update Cache?
When updating a row in the database, should your application:
1. **Update the Cache** with the new value?
2. **Delete the Cache Key** (forcing the next read to query the DB and rebuild the cache)?

**Answer**: In 95% of cases, you should **Delete the Cache Key**.

### Why? The Update Race Condition
If you try to *update* the cache directly without locking, concurrent requests can create a race condition that leaves the cache permanently out of sync with the database:

```text
Time  | Thread 1 (Updates to A)       | Thread 2 (Updates to B)
------|-------------------------------|-------------------------------
T1    | Write value A to Database    | 
T2    |                               | Write value B to Database
T3    |                               | Write value B to Cache
T4    | Write value A to Cache       | 
```

* **Result**: The Database contains value **B**, but the Cache contains value **A**! Because the network operations finished out-of-order, the cache is now permanently stale until it expires.
* **By Deleting the Cache Key instead**: Deletion is idempotent. If both threads delete the key, it doesn't matter which goes first. The next read operation will experience a cache miss, fetch the latest value **B** from the database, and write it cleanly to the cache.


