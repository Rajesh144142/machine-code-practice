# System Design Interview Master Guide & Core Architectures

This guide covers the high-level infrastructure components (DNS, CDN, Caching, DB Selection, Sizing) followed by detailed, step-by-step blueprints for the most asked system design questions.

## Contents

- [Part 1: High-Level Infrastructure Fundamentals](#part-1-high-level-infrastructure-fundamentals)
  - [1. DNS (Domain Name System) Architecture](#1-dns-domain-name-system-architecture)
  - [2. CDN (Content Delivery Network) Architecture](#2-cdn-content-delivery-network-architecture)
  - [3. Caching Levels & Types](#3-caching-levels--types)
  - [4. Database Selection Blueprint (SQL vs. NoSQL)](#4-database-selection-blueprint-sql-vs-nosql)
  - [5. Capacity Estimation & Peak Load Scaling](#5-capacity-estimation--peak-load-scaling)
- [Part 2: Top 10 System Design Questions (Step-by-Step Blueprints)](#part-2-top-10-system-design-questions-step-by-step-blueprints)
- [Part 3: What to Expect AFTER the Initial Architecture Design](#part-3-what-to-expect-after-the-initial-architecture-design)

---

## Part 1: High-Level Infrastructure Fundamentals

```mermaid
graph TD
    Client[Client Browser] -->|1. Resolve domain| DNS[DNS Resolver]
    Client -->|2. Request static files| CDN[CDN Edge Server]
    Client -->|3. Send API traffic| LB[Load Balancer]
    LB -->|4. Route request| Gateway[API Gateway / Nginx]
    Gateway -->|5. Check session/cache| Redis[Redis Cache]
    Gateway -->|6. Query business logic| App[Application Servers]
    App -->|7. Read/Write| DB[Database Cluster]
```

### 1. DNS (Domain Name System) Architecture
DNS resolves human-readable domain names (e.g., `google.com`) into computer-routable IP addresses.

#### The DNS Query Flow (Recursive Resolution):
1. **Browser Cache / OS Cache**: Checks if the IP is already cached locally.
2. **Recursive Resolver (ISP / Google 8.8.8.8)**: If not locally cached, the browser queries the resolver.
3. **Root Name Server (`.`)**: The resolver asks the Root server, which redirects to the TLD name server.
4. **TLD (Top-Level Domain) Server (`.com`, `.net`)**: Redirects the resolver to the Authoritative Name Server of the domain.
5. **Authoritative Name Server**: Returns the final IP address (A / AAAA record) to the resolver, which caches it and returns it to the client.

#### DNS Routing Policies (for Latency & Scaling):
* **Geolocation Routing**: Directs users to the closest data center based on their country.
* **Latency-Based Routing**: Measures round-trip time (RTT) and sends traffic to the fastest server pool.
* **Weighted Round-Robin**: Splits traffic (e.g., 90% to Server Pool A, 10% to Server Pool B for canary testing).

---

### 2. CDN (Content Delivery Network) Architecture
A CDN is a distributed network of proxy servers called **Edge Servers** or **PoPs (Points of Presence)** located globally. They cache static files (images, JS, HTML, videos) physically close to users to reduce latency.

```text
               /---> [Edge Server Europe] ---> [Client EU]
[Origin Server] ---> [Edge Server USA]    ---> [Client US]
               \---> [Edge Server Asia]   ---> [Client Asia]
```

#### CDN Caching Strategies:
* **Pull CDN (Caching on Demand)**:
  * When a user requests an asset, the Edge Server checks its local cache.
  * On a cache miss, the Edge pulls the asset from the **Origin Server** (your app servers), caches it locally, and returns it to the user.
  * *Best for*: Highly dynamic websites or large catalogs of assets.
* **Push CDN (Preloading)**:
  * The application pushes new assets to the CDN Edge servers proactively whenever content changes.
  * *Best for*: Static websites, software releases, or marketing campaigns where content changes infrequently but expects heavy immediate traffic.

#### Latency Reduction:
* **Anycast Routing**: Directs the client to the nearest CDN Edge server using a single IP address routed geographically at the network layer (BGP).
* **TLS Handshake Offloading**: The SSL/TLS handshake is terminated at the CDN edge rather than the origin server, saving network round trips.

---

### 3. Caching Levels & Types

Caching is applied at multiple levels in a scale-out architecture:

1. **Client / Browser Caching**: HTTP headers (`Cache-Control`, `ETag`) prevent the browser from requesting unchanged static resources.
2. **Edge / CDN Caching**: Caches static assets at network-level edge servers.
3. **Reverse Proxy Caching (Nginx / Varnish)**: Caches entire HTTP responses in front of application servers.
4. **Application/Memory Caching (Redis / Memcached)**: Caches database queries, sessions, or computed objects in memory.
5. **Database Cache**: Database engines (PostgreSQL shared buffers, InnoDB buffer pool) store hot index and row blocks in RAM.

---

### 4. Database Selection Blueprint (SQL vs. NoSQL)

One of the most critical design decisions in interviews is choosing the right storage.

#### A. When to Choose SQL (Relational Databases)
* *Examples*: PostgreSQL, MySQL.
* **Key Characteristics**: Schema-on-write, tabular relations, ACID transaction guarantees.
* **Choose SQL when**:
  1. **Transactional Integrity**: You need strict consistency (e.g., banking transactions, e-commerce checkout).
  2. **Complex Relationships**: Your data models have complex many-to-many relationships requiring heavy `JOIN` operations.
  3. **Structured Schemas**: The data structure is clear, stable, and changes infrequently.

#### B. When to Choose NoSQL (Non-Relational Databases)
* *Examples*: DynamoDB, Cassandra, MongoDB.
* **Key Characteristics**: Schema-on-read, horizontal scaling, eventual consistency.
* **Choose NoSQL when**:
  1. **Horizontal Scalability**: You need to scale reads/writes across multiple servers easily without complex database sharding.
  2. **Simple Access Patterns**: You query data by a single partition key (e.g., `user_id` or `short_code`) without needing complex table joins.
  3. **High Write Throughput**: Ingesting massive data streams (logs, sensor telemetry, user clickstreams).

---

### Case Study: SQL vs. NoSQL for a URL Shortener (TinyURL)

In a URL shortener system design, you are mapping a 7-character `shortCode` to a `longUrl`.

#### If we choose SQL (e.g., PostgreSQL):
* *Pros*: Simple setup, schema is clear.
* *Cons*: 
  * Scaling writes requires manual database sharding (partitioning rows by ranges of the short code across different servers).
  * Sharding SQL adds application complexity and can cause hot-key bottlenecks.

#### If we choose NoSQL (e.g., DynamoDB or Cassandra) - RECOMMENDED:
* **Why it fits perfectly**:
  1. **Simple Key-Value Access**: The query is always `GET shortCode` -> returns `longUrl`. There are **zero joins** or relational connections.
  2. **Horizontal Partitioning**: NoSQL databases natively partition data automatically based on the partition key hash (e.g., hashing the `shortCode`).
  3. **Low Write Latency**: Write-intensive scaling is managed out-of-the-box by NoSQL clusters.
  4. **Cost and Maintenance**: Managed NoSQL (like DynamoDB) scales up and down based on reads/writes without needing complex server maintenance.

---

### 5. Capacity Estimation & Peak Load Scaling

When estimating resources in system design interviews, **never size your system only for average loads**. Traffic has natural spikes during active hours (e.g. midday peak, promotions).

#### The Peak Multiplier Rule
* In system design interviews, calculate the daily average QPS, then apply a **peak multiplier (typically 2x to 5x)** to calculate the resource demands during hot hours.
* Size your databases, server instances, and network bandwidth around this **Peak QPS**.
* **Formula**:
  $$\text{Average QPS} = \frac{\text{Daily Requests}}{86,400 \text{ seconds}}$$
  $$\text{Peak QPS} = \text{Average QPS} \times \text{Peak Multiplier (e.g., 3x)}$$

---

---

## Part 2: Top 10 System Design Questions (Step-by-Step Blueprints)

---

### 1. Design a URL Shortener (TinyURL)

#### Step 1: Requirements & Scope
* **Functional**: Shorten long URL $\rightarrow$ 7-character Base62 string. Redirecting via the short URL $\rightarrow$ 302 redirect to the original URL.
* **Non-Functional**: High availability, minimal redirection latency (<50ms).
* **Scale Calculations**:
  * 100M URLs created/day. 
  * **Average Write QPS**: $100\text{M} / 86400 \approx 1,160\text{ writes/sec}$.
  * **Average Read QPS** (ratio 10:1): $11,600\text{ reads/sec}$.
  * **Peak Traffic (3x Multiplier)**:
    * **Peak Write QPS**: $1,160 \times 3 = \mathbf{3,480 \approx 3,500 \text{ writes/sec}}$.
    * **Peak Read QPS**: $11,600 \times 3 = \mathbf{34,800 \approx 35,000 \text{ reads/sec}}$.
  * **Storage (5 years)**: $100\text{M} \times 5 \text{ years} \times 365 \text{ days} \times 500\text{ bytes} \approx \mathbf{90\text{ Terabytes}}$.
  * **Network Bandwidth (Peak)**:
    * Peak Read Bandwidth: $35,000 \text{ reads/sec} \times 500 \text{ bytes} \approx \mathbf{17.5 \text{ MB/sec}}$ (140 Mbps).

#### Step 2: API Contract Design
* `POST /api/v1/shorten` $\rightarrow$ Request: `{"longUrl": "..."}` $\rightarrow$ Response: `{"shortUrl": "..."}`
* `GET /{shortCode}` $\rightarrow$ Redirects user (302 Found) to the long URL.

#### Step 3: Database Selection & Capacity Sizing

We must decide between a NoSQL (DynamoDB) and SQL (PostgreSQL) database. Let's model the resource requirements (servers, CPUs, replicas) for both options to handle the peak loads.

---

### Option A: SQL Database (PostgreSQL Cluster)
To handle the peak load of **3,500 writes/sec** and **35,000 reads/sec**, we provision database nodes on AWS `db.m5.2xlarge` instances (**8 vCPUs, 32GB RAM**). 
* **Sizing Benchmark**: A single `db.m5.2xlarge` PostgreSQL instance can handle:
  * **1,000 write transactions/sec** (limited by disk I/O and transaction commits).
  * **10,000 read queries/sec** (served from memory buffers).

#### 1. Writing Capacity Sizing (Primary Master Database):
* We must support **3,500 writes/sec** at peak.
* Since a single SQL database instance can only support 1,000 writes/sec, we **cannot use a single master database**. We must **Shard (Partition)** the database.
* **Number of Shards Needed**:
  $$\text{Shards} = \frac{3,500 \text{ peak writes/sec}}{1,000 \text{ writes/sec per instance}} = 3.5 \approx \mathbf{4 \text{ Database Shards}}$$
* *Implementation*: We split the database into 4 independent primary master databases (Shard 0 to Shard 3). We route writes using a hash of the short code: `shard_id = Hash(shortCode) % 4`.

#### 2. Reading Capacity Sizing (Read Replicas):
* We must support **35,000 reads/sec** at peak.
* We place a **Redis caching layer** in front of our database, achieving a **90% cache hit ratio**.
* **Database Read Load**: Only 10% of reads hit the database.
  $$\text{Database Reads} = 35,000 \text{ reads/sec} \times 0.10 = \mathbf{3,500 \text{ reads/sec}}$$
* **Distributing reads across the 4 shards**:
  $$\text{Reads per Shard} = \frac{3,500 \text{ reads/sec}}{4 \text{ shards}} = \mathbf{875 \text{ reads/sec per shard}}$$
* Since a single read replica handles 10,000 reads/sec, **1 replica per shard** is more than enough to cover the reads, even if the cache has a temporary failure.
* **SQL Cluster Sizing**: 
  * **4 Sharded Primary Masters** (for writes).
  * **4 Read Replicas** (1 attached to each master for reads).
  * **Total SQL Instances**: **8 Database Servers** (8 vCPUs / 32GB RAM each).

---

### Option B: NoSQL Database (DynamoDB) - RECOMMENDED
* **Why it fits**: 
  1. **Managed Scaling**: DynamoDB dynamically scales partitioning automatically. It hashes the partition key (`short_code`) to route requests to different storage nodes without application-level sharding logic.
  2. **Cost-Effective**: We configure DynamoDB with **3,500 Write Capacity Units (WCU)** and **3,500 Read Capacity Units (RCU)** (assuming 90% read cache hits).
  3. **Zero Joins**: Our data access is 100% key-value lookup (`shortCode -> longUrl`), which matches NoSQL patterns perfectly.


#### Step 4: High-Level Architecture
```text
[Client] ---> [DNS] ---> [Nginx Load Balancer] ---> [Web Application Servers]
                                                       |         |
                                         (Read Cache)  v         v  (Write DB)
                                                  [Redis]     [DynamoDB]
```

#### Step 5: Detailed Design: Unique ID Generation
To generate the 7-character code without collisions:
* Use a distributed counter generator (like **Twitter Snowflake** or a **Zookeeper Range Coordinator**).
* Zookeeper issues ranges of IDs (e.g., Server A gets `1` to `1,000,000`, Server B gets `1,000,001` to `2,000,000`).
* The app server takes the integer ID and encodes it into a Base62 string (`[a-zA-Z0-9]`), ensuring absolute uniqueness with zero database collision checks.

---

### 2. Design a Rate Limiter

#### Step 1: Requirements & Scope
* **Functional**: Limit API requests per user (e.g., max 100 requests/min).
* **Non-Functional**: Sub-millisecond latency overhead, distributed scalability.

#### Step 2: Algorithm Comparison
* **Token Bucket**: Stores `tokens` and `last_updated_time`. Allows traffic bursts.
* **Sliding Window Counter**: Highly accurate, low memory. Evaluates requests based on: `current_window_count + previous_window_count * overlap_percentage`.

#### Step 3: High-Level & Detailed Design
The Rate Limiter runs as a middleware at the **API Gateway** layer:
1. Client request hits API Gateway.
2. Gateway extracts client identifier (IP or User ID).
3. Gateway runs an atomic **Redis Lua script** evaluating the Token Bucket or Sliding Window logic.
4. If tokens > 0, request is forwarded to App Servers. If not, returns `429 Too Many Requests`.

```text
[Client] ---> [API Gateway (Limiter Middleware)] ---> [App Servers]
                        |
            (Atomic Lua script query)
                        v
                 [Redis Cache]
```

---

### 3. Design an Instant Messaging App (WhatsApp/Slack)

#### Step 1: Requirements & Scope
* **Functional**: One-on-one chat, delivery receipts (sent, delivered, read), user online status.
* **Non-Functional**: Real-time delivery (<100ms), no message loss.

#### Step 2: Communication Protocol
* **WebSockets**: Establishes a persistent TCP connection between client and server, allowing bi-directional streaming.

#### Step 3: High-Level Architecture
* **WebSocket Gateways**: Stateful servers that hold open TCP connections for online users.
* **Presence Service**: Keeps track of user online status using a fast heartbeat in Redis.
* **Message Broker / MQ**: Distributes messages between gateway nodes.

```text
[User A] ---> [WebSocket Gateway 1] ---> [Message Broker] ---> [WebSocket Gateway 2] ---> [User B]
                                              |
                                              v (Write)
                                       [Cassandra DB]
```

#### Step 4: Database Selection
* **Cassandra (Wide-Column Store)**: Perfect for chat histories. Partition Key: `chat_id`, Clustering Key: `message_id` (timeuuid).
* **Reason**: Cassandra supports extremely high-write throughput and retrieves chat histories sequentially from disk in milliseconds.

---

### 4. Design a Video Streaming Service (YouTube/Netflix)

#### Step 1: Requirements & Scope
* **Functional**: Upload video, stream video at variable bitrates, view counter.
* **Non-Functional**: Highly available, low buffering latency.

#### Step 2: High-Level Architecture
```text
[User Upload] ---> [API Gateway] ---> [Raw S3 Bucket] ---> [Transcoding Workers] ---> [CDN S3 Bucket]
                                                                                            |
[User Stream] <--- [CDN Edge (Anycast)] <---------------------------------------------------+
```

#### Step 3: Component Deep-Dive (Transcoding & Streaming)
* **File Chunking**: Raw videos are split into 4-second chunks (`.ts` or `.m4s`).
* **Transcoding Engine**: Converts chunks into different formats (HLS, DASH) and multiple resolutions (1080p, 720p, 480p) asynchronously using a queue.
* **Adaptive Bitrate Streaming (ABR)**: The client video player dynamically shifts resolutions between chunks depending on the user's changing internet speed.

#### Step 4: Storage & CDN Strategy
* **BLOB Storage (S3)**: Houses all static video chunks.
* **CDN (Pull Strategy)**: Caches hot chunks at edge servers. Unpopular (long-tail) chunks are fetched from S3 on demand.

---

### 5. Design a Notification System

#### Step 1: Requirements & Scope
* **Functional**: Send Email, SMS, and Mobile Push Notifications.
* **Non-Functional**: Highly reliable (at-least-once), rate-limiting.

#### Step 2: High-Level Architecture
Decouple services using **Message Queues**:
```text
[App Server] ---> [API Gateway] ---> [Notification Service]
                                            |
                                            v (Push to Queues)
                                   [SMS / Push / Email MQ]
                                            |
                                            v (Consume)
                                    [Worker Instances] ---> [APNs / Twilio / SendGrid]
```

#### Step 3: Key Operations
* **Deduplication**: Store `notification_uuid` in Redis with a 24-hour TTL. If a duplicate comes in, reject it.
* **Rate Limiting**: Ensure users aren't spammed with too many notifications (e.g. max 3 marketing notifications/day).

---

### 6. Design an E-Commerce Checkout / Ticket Booking System

#### Step 1: Requirements & Scope
* **Functional**: Reserve seat/item, process payment, confirm order.
* **Non-Functional**: Strict Consistency (no double booking).

#### Step 2: Database Selection
* **SQL (PostgreSQL / MySQL)**: Strict transaction ACID requirements to ensure reservation and payment commit atomically or rollback cleanly.

#### Step 3: Concurrency Control (Preventing Double Booking)
* **Distributed Locking (Redis/Redlock)**:
  * When a user selects a seat: `SET seat:123 "locked" EX 600 NX` (Locks seat for 10 mins).
  * If successful, user proceeds to checkout.
  * If payment succeeds, write transaction to Postgres, commit, and delete the Redis lock.
  * If payment fails or 10 mins expires, lock is cleared automatically, releasing the seat.

---

### 7. Design a News Feed System (Twitter/Facebook)

#### Step 1: Requirements & Scope
* **Functional**: Post update, view news feed, follow users.
* **Non-Functional**: Low latency feed generation (<200ms).

#### Step 2: Hybrid Fan-out Strategy
* **Normal Users**: Use the **Push Model (Fan-out on Write)**. When they post, write the post ID to their followers' cached timelines in Redis.
* **Celebrities (Hot Keys)**: Use the **Pull Model (Fan-out on Read)**. Do not push celebrity posts to millions of follower caches. Instead, when a follower loads their feed, merge the celebrity's posts on-the-fly.

```text
[Post Creation] ---> [Fan-out Worker] ---> [Update follower feeds in Redis]
[Feed Request]  ---> [Merge Worker]   ---> [Read follower feed + Fetch Celeb posts on-read]
```

---

### 8. Design a Distributed Cache (Redis-like)

#### Step 1: Requirements & Scope
* **Functional**: Get/Set keys, TTL eviction.
* **Non-Functional**: Sub-millisecond latency, horizontal scalability.

#### Step 2: Sharding & Consistency Ring
* **Consistent Hashing**: Keys and servers are mapped to a 360-degree virtual ring. A key is routed to the nearest cache server clockwise.
* **Virtual Nodes**: To prevent uneven key distribution (hot spots), map multiple virtual nodes per physical cache server on the ring.

```text
         Cache Node A (V1)
       /                   \
  Key 1                     Cache Node B (V1)
    |                          |
  Key 3                     Key 2
       \                   /
         Cache Node A (V2)
```

---

### 9. Design a Ride-Hailing Service (Uber/Lyft)

#### Step 1: Requirements & Scope
* **Functional**: Drivers share location; match rider with closest driver.
* **Non-Functional**: High-frequency real-time updates.

#### Step 2: Spatial Indexing
* **Uber H3 (Hexagonal Grid)**: Divides the Earth into hierarchical hexagons. 
* Drivers' coordinates are updated in **Redis Geospatial Indexes** (`GEOADD`), storing longitude/latitude in a sorted set mapped by H3 cells.
* Finding close drivers: Query `GEORADIUS` around the rider's coordinate.

---

### 10. Design a Web Crawler

#### Step 1: Requirements & Scope
* **Functional**: Crawl seed URLs, parse HTML, extract links, index contents.
* **Non-Functional**: Politeness (don't DDOS sites), scalability.

#### Step 2: Core Components
* **URL Frontier**: The link repository queue.
* **Politeness Engine**: Routes requests to target domains through dedicated queues with delays, checking `robots.txt` first.
* **Deduplication Engine**: Uses **Bloom Filters** to check if a URL has already been visited, and **SimHash** to check if page content is duplicate.

---

## Part 3: What to Expect AFTER the Initial Architecture Design

Once you present the boxes and arrows of your high-level architecture, the interviewer will immediately start probe-testing the design. You can expect follow-up questions in four categories:

### 1. Failures and Outages (The "Chaos" Questions)
* **Q: "What happens if your Redis cache crashes? How do you prevent your database from going down?"**
  * **Answer**: If the cache fails, a surge of read requests (Cache Stampede) will hit the database and crash it. To prevent this, we implement **Circuit Breakers** on the database read-bypass layer. If the DB failure rate spikes, we trip the circuit and return stale/fallback data or fail-fast. We also use **Mutex Locks** (single-flight) so only one app request goes to rebuild the cache, keeping database hits to a trickle.
* **Q: "Your Primary database master just went offline. How does the system recover?"**
  * **Answer**: We use a health-check coordinator (e.g., Zookeeper or Sentinel) to detect the primary master's death. It automatically promotes one of the read replicas to be the new master. We also need to configure the application servers to route write traffic to the new IP/DNS master node automatically.

---

### 2. High Scale and Bottlenecks (The "10x Traffic" Questions)
* **Q: "If our write traffic spikes 10x, your single SQL master DB will choke on disk commits. How do you scale writes?"**
  * **Answer**: We scale writes in two ways:
    1. **Asynchronous Write Buffering**: Instead of writing directly to the database synchronously, the API writes the request payload to a high-throughput **Message Queue** (like Kafka) and returns. A worker pool drains the queue and writes to the DB in micro-batches, smoothing out the traffic spike.
    2. **Horizontal Database Sharding**: We split the database into multiple physical masters and hash-partition the rows (e.g., by `User_ID`) across the database shards.
* **Q: "How do you prevent the 'Hot Key' problem (e.g., millions of users querying a single celebrity's profile or a viral URL short link) from crushing a single Cache Node?"**
  * **Answer**: We implement **Local Memory Caching** (In-App cache) on the web app servers themselves using a small cache (like LRU) with a short TTL (e.g., 5 seconds). The most popular keys are resolved inside the local node before hitting Redis over the network. We also use **Consistent Hashing with Virtual Nodes** to distribute keys evenly.

---

### 3. Data Consistency and Synchronization
* **Q: "If you scale horizontally with read replicas, how do you prevent the 'Read-Your-Own-Writes' consistency problem?"**
  * **Answer**: When a user writes data (e.g. edits a profile), the update takes time to replicate to read replicas (replication lag). If the user refreshes, they might see old data. To fix this, we route requests from the user who made the write directly to the **Primary Master database** for a small window (e.g., 5 seconds) before routing them back to the read replicas.
* **Q: "How do you handle out-of-order messages in your Chat application?"**
  * **Answer**: In WebSockets, we cannot guarantee sequence at the network level. To resolve this, we append a **Sequence ID** (like a monotonically increasing counter or Snowflake ID) to every message at the server. The client application sorts the messages locally in memory by this sequence ID before rendering them to the UI.

