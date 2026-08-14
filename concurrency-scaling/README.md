# Concurrency & Scaling Fundamentals

This guide covers hardware constraints (vCPUs), OS constraints (File Descriptors), database connection pooling limits, and how to scale applications effectively on virtualized cloud servers.

## Contents

- [Understanding 2 vCPU T3 Cloud Servers](#understanding-2-vcpu-t3-cloud-servers)
- [Server Concurrency Bottlenecks (File Descriptors & RAM)](#server-concurrency-bottlenecks-file-descriptors--ram)
- [Database Connection Pooling Issues](#database-connection-pooling-issues)
- [Practical Scaling Solutions & Best Practices](#practical-scaling-solutions--best-practices)
- [Load Balancing Algorithms](#load-balancing-algorithms)
- [Real-World Concurrency Modeling & Capacity Planning](#real-world-concurrency-modeling--capacity-planning)

---

## Understanding 2 vCPU T3 Cloud Servers

When deploying an application to AWS (e.g., a `t3.medium` instance), you are allocated **2 vCPUs** and **4GB RAM**. Let’s break down exactly what this means:

### 1. What is a vCPU?
A **vCPU (Virtual Central Processing Unit)** is a single thread of execution assigned by the hypervisor to a virtual machine (VM).
* **vCPU vs. Physical Core**: Modern server chips use Hyper-Threading (Intel) or SMT (AMD). A single physical CPU core runs 2 hardware threads. AWS maps each hardware thread to 1 vCPU.
* **The Reality**: A 2 vCPU instance is physically **1 CPU core** running 2 hyper-threads. Only 2 instructions can run at the *exact same microsecond* in physical hardware.

### 2. What is a "T3" Instance? (The Bursting Catch)
`T3` is a **burstable performance instance class**. 
* **CPU Credits**: AWS grants you "credits" when your instance is idle. When traffic spikes, your instance uses these credits to burst to 100% CPU performance.
* **The Bottleneck**: If your app runs at high CPU (e.g., 80-100%) for an extended period, you will **run out of CPU credits**.
* **What happens then?**: AWS will aggressively throttle your instance down to its **baseline performance** (e.g., 20% or 40% CPU capacity). To your users, your site will suddenly feel extremely slow, requests will time out, and health checks will fail.
* **Solution**: Enable `T3 Unlimited` (which charges a fee if you exceed credits instead of throttling) or upgrade to a dedicated instance class (like `c5` for CPU-heavy tasks or `m5` for general memory/CPU balance).

### 3. How vCPUs Relate to Runtimes
* **Node.js (Single-Threaded)**: Node.js runs its main JavaScript event loop on a single thread. Therefore, a single Node.js process **can only use 1 vCPU**. If you deploy a single Node.js app on a 2 vCPU server, 50% of your CPU capacity goes unused!
  * *Fix*: Run 2 Node.js process instances using **PM2 Cluster Mode** or Docker.
* **Go / Java / .NET (Multi-Threaded)**: These runtimes automatically spawn multiple OS threads and distribute them across all available vCPUs. The OS uses **context switching** to schedule thousands of active threads on your 2 vCPUs.
  * *The Trap*: If you spawn too many active threads (e.g., 500 threads on a 2 vCPU server), the CPU will spend more time switching between threads (saving/restoring registers) than doing actual work. This is called **thrashing**.

---

## Server Concurrency Bottlenecks (File Descriptors & RAM)

How many concurrent connections can a single server handle? It is rarely limited by CPU alone. The two main culprits are **RAM** and **OS File Descriptors**.

### 1. File Descriptors Limit (Linux `ulimit`)
In Linux, "everything is a file". When a client connects to your server via TCP, Linux opens a network socket, which consumes **1 File Descriptor (FD)**.
* **The default limit**: On most Linux servers, the default maximum FDs per process is **1024**.
* **What happens**: If your server receives 1025 concurrent requests, the OS will reject the connection with the error: `EMFILE (Too many open files)`.
* **The Fix**: Increase the soft/hard limits inside `/etc/security/limits.conf`:
  ```bash
  * soft nofile 65535
  * hard nofile 65535
  ```

### 2. RAM (Memory-per-Connection)
Every active connection consumes RAM.
* **TCP Buffers**: Each open socket requires read/write memory buffers allocated by the Linux kernel (usually 4KB - 64KB per socket).
* **Thread Stacks**: Multi-threaded runtimes (like Java) allocate stack memory for each thread (default is often 1MB per thread). If you have 2000 active threads, you consume **2GB of RAM** just for the thread stacks, leaving only 2GB of RAM for your application heap on a 4GB T3 server!

---

## Database Connection Pooling Issues

An API server must connect to a database (e.g., PostgreSQL or MySQL). To avoid opening and closing a TCP connection on every API call (which takes ~15-30ms), we use a **Connection Pool**.

```text
[HTTP Requests] (1000 concurrent)
      |
      v
[API Server] (Connection Pool Size = 20)
      |
  (Only 20 database connections are active/shared)
      v
[Database Server (Postgres)] (max_connections = 100)
```

### 1. The Database Connection Pool Trap
You might think: *"If I have 1000 concurrent users, I should set my database connection pool size to 1000."* **This is wrong.**
* **Why?**: PostgreSQL forks a separate OS process for *every* connection. 1000 connections require 1000 Postgres processes. 
* **The Bottleneck**: The database server (which also runs on limited CPUs) will spend almost all of its CPU capacity context-switching between 1000 active processes. Performance will degrade exponentially.
* **PostgreSQL Rule of Thumb**:
  $$\text{Connections} \approx ((\text{Core Count} \times 2) + \text{Spindle Count})$$
  On a small database server with 2 CPU cores, a pool size of **15 to 30** is actually *faster* than a pool size of 200.

### 2. Pool Starvation (`ConnectionAcquisitionTimeout`)
If your API server has 100 concurrent worker threads, but your database connection pool size is set to **10**:
* 10 threads will grab a DB connection and run queries.
* 90 threads will block, waiting for a connection to be released back into the pool.
* If a database query is slow (e.g., taking 2 seconds), those 90 waiting threads will time out with a `ConnectionAcquisitionTimeout` or `PoolTimeout` error.

---

## Practical Scaling Solutions & Best Practices

To handle high concurrency on limited hardware like a 2 vCPU / 4GB RAM server, implement these configurations:

### 1. Use PM2 Cluster Mode (For Node.js)
Multiply your Node.js processes to match your vCPU count to utilize all cores.
```bash
# Start Node.js app utilizing all available cores
pm2 start app.js -i max
```

### 2. Use an External Connection Pooler (PgBouncer)
If you run multiple instances of your API server (e.g., 5 servers, each with a pool size of 20), you hit the database with 100 connections. If you scale to 50 servers, you hit the database with 1000 connections.
* **The Solution**: Deploy **PgBouncer** in front of PostgreSQL. 
* PgBouncer acts as a lightweight proxy. Your 50 API servers connect to PgBouncer (which can handle 10,000 idle client connections), and PgBouncer multiplexes them into a tiny pool of **20 actual connections** to the Postgres database.

```text
[50 API Servers] (1000 connections total)
      |
      v
[PgBouncer Proxy] (Multiplexes/Queues requests)
      | (20 actual TCP connections)
      v
[PostgreSQL DB] (Keeps CPU low and queries fast)
```

### 3. Load Shedding & Rate Limiting
Do not let your server crash. If your server is approaching its limits, reject new requests early (load shedding) rather than letting everything time out.
* Return a fast `503 Service Unavailable` or `429 Too Many Requests` at the Nginx/API Gateway layer so the core application servers don't choke.

### 4. Monitor CPU Credit Balance
Keep a CloudWatch Alarm on your `CPUCreditBalance` metric. If it drops below 50, trigger an autoscaling rule to spin up another instance or send an alert to migrate to an `M5` instance.

---

## Load Balancing Algorithms

To scale horizontally, you deploy multiple application servers behind a **Load Balancer** (like Nginx, AWS ALB, or HAProxy). The load balancer uses algorithms to decide where to route each incoming request:

### 1. Round Robin
Distributes incoming requests sequentially down the list of servers.
* **Best For**: Flat, homogeneous environments where all servers have identical hardware specs and tasks take roughly equal time.
* **Weighted Round Robin**: Assigns a weight (e.g. Server A has weight 3, Server B has weight 1). Server A receives 3 consecutive requests for every 1 that goes to Server B. Ideal when mixing strong and weak servers.

### 2. Least Connections
Routes requests to the server with the fewest active, open client connections.
* **Best For**: Persistent connection setups (like WebSockets or long database queries) where connection durations vary wildly. It prevents one server from getting overloaded with long-running tasks.

### 3. IP Hash
Hashes the client's IP address to map them consistently to a specific server.
* **Best For**: "Sticky sessions" where a client must reconnect to the same server to access local session caches or state.
* **Cons**: Can lead to uneven load distribution (e.g. many clients behind a single office corporate proxy share one IP).

---

## Real-World Concurrency Modeling & Capacity Planning

Let's evaluate a realistic capacity planning problem.

### The Scenario:
* **Total Users**: 10,000 total users.
* **Peak Traffic**: **1,500 concurrent users** actively executing requests at the exact same time.
* **Baseline Traffic**: **100 concurrent users**.
* **The API endpoint (Booking API)**: A slow, heavy endpoint that performs multiple DB queries, runs high-computation logic, and calls third-party APIs (Email, SMS).
* **Average Latency**: **3 seconds** per request.
* **Database Constraints**: PostgreSQL database has a connection pool size of **30**.
* **Server Hardware**: 2 vCPU / 4GB RAM instance (`t3.medium`).

---

### Step 1: Database Throughput Modeling (The 30-Connection Pool Limit)

If your database connection pool is capped at **30 connections**, the throughput threshold depends entirely on **how long the database connection is held open during the 3-second request lifecycle**:

#### Case A: Synchronous Blocking (The Anti-Pattern)
* **The Mistake**: Your API server opens a transaction, queries the DB, blocks for 2.5 seconds waiting for Twilio/SendGrid APIs (SMS/Email) to respond, updates the DB, commits, and releases the connection. The database connection is held open for the full **3 seconds**.
* **The Math**:
  $$\text{Throughput per Connection} = \frac{1 \text{ request}}{3 \text{ seconds}} \approx 0.33 \text{ req/sec}$$
  $$\text{Max System Throughput} = 30 \text{ connections} \times 0.33 \text{ req/sec} = 10 \text{ req/sec}$$
* **What happens at peak (1500 users)?**
  * If 1,500 users click "Book" at the same moment, the database can only process 10 requests per second.
  * The queue time for the last user in the queue is:
    $$\text{Wait Time} = \frac{1,500 \text{ requests}}{10 \text{ req/sec}} = 150 \text{ seconds (2.5 minutes!)}$$
  * **Result**: Complete system failure. Every client browser will time out (typical HTTP timeout is 30s) and throw a `504 Gateway Timeout`.

#### Case B: Decoupled Non-Blocking (The Scalable Solution)
* **The Fix**: Release the database connection *before* calling slow third-party APIs.
  1. Acquire a DB connection, execute the queries, commit, and **immediately release the connection** back to the pool (taking **50ms / 0.05s** of database time).
  2. Put the Email/SMS payload into a background message queue (e.g., Redis/RabbitMQ).
  3. Send the HTTP response back to the user.
  4. A background worker pulls from the queue and calls the external Email/SMS APIs.
* **The Math**:
  $$\text{Throughput per Connection} = \frac{1 \text{ request}}{0.05 \text{ seconds}} = 20 \text{ req/sec}$$
  $$\text{Max System Throughput} = 30 \text{ connections} \times 20 \text{ req/sec} = 600 \text{ req/sec}$$
* **What happens at peak (1500 users)?**
  * If 1,500 users click "Book" over a 10-second window (150 req/sec load), the 30-connection pool easily handles the load since it has a 600 req/sec capacity.

---

### Step 2: Server Capacity Planning (How many servers do we need?)

Now let's compute the hardware resources (2 vCPU servers) needed to handle the active requests.

#### A. Handling Baseline Traffic (100 Concurrent Users)
* **Active concurrent requests** = 100.
* **If I/O Bound (waiting on external APIs/DB)**:
  * *Node.js*: A single Node.js process easily holds 100 concurrent idle sockets because it uses non-blocking I/O. Since we have a 2 vCPU server, we run 2 Node.js processes (using PM2).
  * *Java (Thread-per-request)*: Spawns 100 threads. Thread stack memory: $100 \times 1\text{MB} = 100\text{MB}$ of RAM. A 2 vCPU / 4GB RAM server handles this easily.
  * **Result**: **1 single 2 vCPU server** is sufficient for 100 concurrent users.

#### B. Handling Peak Traffic (1,500 Concurrent Users)
* **Active concurrent requests** = 1,500.
* **Let's assume our code takes 50ms of active CPU computation time** (JSON serialization, crypto, arrays) during the 3-second cycle:
  $$\text{Total CPU time needed per second} = \frac{1,500 \text{ requests} \times 50\text{ms}}{3 \text{ seconds}} = 25,000\text{ms of CPU work per second}$$
  Since 1 CPU core provides 1,000ms of CPU time per second:
  $$\text{vCPUs Required} = \frac{25,000\text{ms}}{1,000\text{ms}} = 25 \text{ vCPUs}$$
* **The Math for 2 vCPU Servers**:
  * Each server has 2 vCPUs.
  * Total servers needed:
    $$\text{Servers} = \frac{25 \text{ vCPUs}}{2 \text{ vCPUs/Server}} \approx 13 \text{ servers}$$
  * *Thread-per-request note*: Running 1,500 threads on a single 2 vCPU server is impossible. The OS will spend 90% of its CPU time context-switching between 1,500 threads (CPU thrashing). A 2 vCPU server can safely run at most **150 active threads**.
    $$\text{Servers needed for Thread Pool} = \frac{1,500 \text{ active threads}}{150 \text{ threads/Server}} = 10 \text{ servers}$$
* **Result**: For peak load (1,500 concurrent users), you need **10 to 13 servers** of 2 vCPUs each, fronted by a Load Balancer.

---

### Step 3: Architecture Summary for 1,500 Peak Users

To handle 1,500 peak concurrent bookings without scaling database connections to infinity:

1. **Load Balancer**: Distributes 1,500 concurrent hits using **Least Connections** across 12 app servers.
2. **App Servers (12 instances of 2 vCPUs)**:
   * Node.js runtimes run PM2 in cluster mode (2 processes per instance, utilizing all vCPUs).
   * OS file descriptors limit increased to `65535` (`ulimit -n`).
3. **Database Connection Pool (PgBouncer)**:
   * Placed in front of PostgreSQL.
   * Multiplexes the connections from all 12 app servers into a tight, optimized pool of **30 active connections** to Postgres.
4. **Asynchronous Background Processing (Message Queue)**:
   * The application completes the database transaction in **<50ms**, commits, and writes the slow Email/SMS task to **Redis/BullMQ**.
   * Background worker instances process the queue tasks asynchronously, protecting the user's booking transaction from external network delays.


