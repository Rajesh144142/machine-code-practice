# Concurrency & Sizing: The Mathematical Blueprint

This guide walks through the exact math, CPU/RAM sizing, and database pooling calculations needed to scale a heavy booking application from **100 baseline concurrent users** to **1,500 peak concurrent users**.

---

## The Scenario Details
* **Total Users**: 10,000 total users.
* **Peak Load**: **1,500 concurrent users** clicking "Book" at the same moment.
* **Baseline Load**: **100 concurrent users** clicking "Book" at the same moment.
* **The Booking API**: A slow, heavy endpoint that performs multiple DB queries, runs active computations, and calls external APIs (sending email & SMS).
* **Average Latency**: **3 seconds** per request.
* **Database Constraints**: PostgreSQL database with a connection pool size of **30**.
* **Server specs**: 2 vCPU / 4GB RAM cloud instance (`t3.medium`).

---

## 1. Database Sizing: The 30-Connection Pool Limit

If your database connection pool is locked at **30 connections**, the system's capacity is determined by **how long the database connection is held open during the 3-second request lifecycle**.

### Case A: The Blocking API (Database connection held for the full 3 seconds)
In this implementation, the database connection is opened at the start, queries are run, the code blocks for 2+ seconds waiting for external Email/SMS APIs to respond, updates are run, and the connection is committed and released.
* **Throughput per Connection**: 
  $$\text{Throughput} = \frac{1 \text{ request}}{3 \text{ seconds}} = 0.33 \text{ requests per second (RPS)}$$
* **Total DB Pool Capacity**: 
  $$30 \text{ connections} \times 0.33 \text{ RPS} = \mathbf{10 \text{ RPS}}$$

#### Impact Analysis:
1. **For 100 Concurrent Users**:
   * If 100 users click "Book" simultaneously, only 30 grab connections immediately. The remaining 70 wait in the queue.
   * *Wait Time*: The last batch of users will wait in queue for **9 seconds** before their request even begins processing. Average latency degrades from 3s to **7.5 seconds**.
2. **For 1,500 Concurrent Users (Peak)**:
   * If 1,500 users click "Book" at the same time, 30 get connections and 1,470 wait.
   * *Wait Time*: The last user in the queue will wait:
     $$\text{Queue Wait Time} = \frac{1,470 \text{ requests}}{30 \text{ connections}} \times 3 \text{ seconds} = \mathbf{147 \text{ seconds (2.45 minutes!)}}$$
   * *Result*: Since load balancers and browsers timeout after 30 seconds, **90% of requests will fail with 504 Gateway Timeouts**. The database pool becomes a terminal bottleneck.

---

### Case B: The Non-Blocking API (Database connection released in 50ms)
In this optimized design, the database connection is acquired, queries are run, the transaction is committed, and the connection is **immediately released back to the pool** (taking only **50ms / 0.05s** of database time). The server then puts the email/SMS tasks on an asynchronous background queue (like Redis/BullMQ) and returns success.
* **Throughput per Connection**: 
  $$\text{Throughput} = \frac{1 \text{ request}}{0.05 \text{ seconds}} = 20 \text{ requests per second (RPS)}$$
* **Total DB Pool Capacity**: 
  $$30 \text{ connections} \times 20 \text{ RPS} = \mathbf{600 \text{ RPS}}$$

#### Impact Analysis:
* The 30-connection database pool can now handle **600 database queries/writes per second**. 
* Under 1,500 peak users, the database pool will process the load in under **2.5 seconds** without queuing or timing out.

---

## 2. Server Sizing: How many 2 vCPU servers do we need?

Assume the JavaScript code execution (JSON parsing, validations, calculations) takes **100 milliseconds** of active CPU work per request. The other 2.9 seconds is idle waiting time (waiting on DB or third-party APIs).

### A. Sizing for 100 Concurrent Users (Baseline)
* **Total CPU time required per second**:
  $$\text{CPU Time} = 100 \text{ concurrent requests} \times \frac{100\text{ms active CPU}}{3 \text{ seconds request duration}} = 3.33 \text{ seconds of CPU time per second}$$
* **vCPUs Required**: (1 vCPU core delivers 1 second of execution time per second)
  $$\text{vCPUs} = 3.33 \text{ vCPUs}$$
* **Server Sizing**: (Each server has 2 vCPUs)
  $$\text{Servers Needed} = \frac{3.33 \text{ vCPUs}}{2 \text{ vCPUs/Server}} \approx \mathbf{2 \text{ Servers}}$$

---

### B. Sizing for 1,500 Concurrent Users (Peak)
* **Total CPU time required per second**:
  $$\text{CPU Time} = 1,500 \text{ concurrent requests} \times \frac{100\text{ms active CPU}}{3 \text{ seconds request duration}} = 50 \text{ seconds of CPU time per second}$$
* **vCPUs Required**:
  $$\text{vCPUs} = 50 \text{ vCPUs}$$
* **Server Sizing**: (Each server has 2 vCPUs)
  $$\text{Servers Needed} = \frac{50 \text{ vCPUs}}{2 \text{ vCPUs/Server}} = \mathbf{25 \text{ Servers}}$$

---

## 3. Thread-Level Limits: Java vs. Node.js

To support 1,500 active concurrent requests on the application layer:

### If using Java (Thread-per-Request):
* The server needs 1,500 active OS threads.
* **Memory Overhead**: 1,500 threads $\times$ 1MB thread stack = **1.5GB of RAM** just to allocate the threads.
* **Context-Switching Limit**: A 2 vCPU server will choke due to CPU **thrashing** (context switching overhead) if it runs 1,500 threads. Safe limit is **150 threads per server**.
* **Servers needed**: 
  $$\text{Servers} = \frac{1,500 \text{ threads}}{150 \text{ threads/server}} = \mathbf{10 \text{ Servers}}$$

### If using Node.js (Single-Threaded Event Loop):
* Node.js handles 1,500 concurrent connections asynchronously on a single thread.
* However, because of the CPU computation time (100ms per request), the single thread will block. 
* To prevent event loop lag, you must distribute the requests across **25 servers** (each running 2 Node.js processes in cluster mode).

---

## 4. Summary Sizing Checklist

| Metric | Baseline (100 Concurrent) | Peak (1,500 Concurrent) |
| :--- | :--- | :--- |
| **Max Concurrent Requests** | 100 | 1,500 |
| **Total vCPUs Required** | 3.3 vCPUs | 50 vCPUs |
| **Number of 2-vCPU / 4GB Servers** | **2 Servers** | **25 Servers** |
| **PostgreSQL Pool Limit** | 30 (held for <50ms) | 30 (held for <50ms) |
| **Critical Architecture Pattern** | Simple API is okay | Must use Asynchronous Message Queue |
