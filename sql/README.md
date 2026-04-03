# SQL Fundamentals - Queries You Should Know

This README is a short, practical guide to common SQL topics with real examples.

## Contents

- [Sample Tables](#sample-tables)
- [Common Data Types](#common-data-types)
- [Basic DDL and DML](#basic-ddl-and-dml)
- [Joins](#joins)
- [Subqueries](#subqueries)
- [JOIN vs EXISTS vs IN](#join-vs-exists-vs-in)
- [Views](#views)
- [CASE](#case)
- [Aggregations](#aggregations)
- [GROUP BY, HAVING, ORDER BY](#group-by-having-order-by)
- [Loops (Procedural SQL)](#loops-procedural-sql)
- [Advanced Topics](#advanced-topics)
- [Best Practices](#best-practices)
- [Common Mistakes](#common-mistakes)
- [What Else To Add](#what-else-to-add)

## Sample Tables

Use this sample schema in examples:

```sql
-- customers
-- id (INT) | name (VARCHAR) | city (VARCHAR)

-- orders
-- id (INT) | customer_id (INT) | order_date (DATE) | total_amount (DECIMAL)

-- order_items
-- id (INT) | order_id (INT) | product_id (INT) | qty (INT) | unit_price (DECIMAL)

-- products
-- id (INT) | name (VARCHAR) | category (VARCHAR)
```

## Common Data Types

- `INT`: whole numbers
- `DECIMAL(p,s)`: exact numbers for money
- `VARCHAR(n)`: text
- `DATE`: date only
- `TIMESTAMP`: date + time
- `BOOLEAN`: true/false

Example table:

```sql
CREATE TABLE payments (
  id INT,
  user_id INT,
  amount DECIMAL(10,2),
  currency VARCHAR(3),
  paid_on DATE,
  created_at TIMESTAMP,
  is_refunded BOOLEAN
);
```

## Basic DDL and DML

Create table:

```sql
CREATE TABLE customers (
  id INT,
  name VARCHAR(100),
  city VARCHAR(100)
);
```

Alter table:

```sql
ALTER TABLE customers ADD COLUMN email VARCHAR(255);
```

Update data:

```sql
UPDATE customers SET city = 'Delhi' WHERE id = 1;
```

Delete rows:

```sql
DELETE FROM customers WHERE id = 10;
```

Drop table:

```sql
DROP TABLE customers;
```

Drop database:

```sql
DROP DATABASE mydb;
```

## Joins

Use joins to combine rows from multiple tables.

```sql
SELECT c.name, o.id AS order_id, o.total_amount
FROM customers c
JOIN orders o ON o.customer_id = c.id;
```

Common join types:
- INNER JOIN: only matching rows
- LEFT JOIN: keep all left rows
- RIGHT JOIN: keep all right rows
- FULL OUTER JOIN: keep all rows from both sides

### What If Data Is Missing?

```sql
SELECT c.name, o.id AS order_id, o.total_amount
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id;
```

Result behavior:
- If a customer has no orders, the order columns are `NULL`.
- INNER JOIN would drop those customers completely.

## Subqueries

Use a subquery to filter or compute before the main query.

```sql
SELECT c.id, c.name
FROM customers c
WHERE c.id IN (
  SELECT o.customer_id
  FROM orders o
  GROUP BY o.customer_id
  HAVING SUM(o.total_amount) > (
    SELECT AVG(total_amount) FROM orders
  )
);
```

## JOIN vs EXISTS vs IN

JOIN:
- Use when you need columns from both tables.
- Performance: good with proper indexes on join keys.
- Real life example: show customer name + order amount.

EXISTS:
- Use when you only need to know if a match exists.
- Performance: often faster than JOIN for large related tables because it stops at first match.
- Real life example: list customers who have at least one order.

IN:
- Use for small fixed lists or small subquery results.
- Performance: fine for small sets, but can be slower for very large subquery results.
- Real life example: filter customers in 5–10 cities.

Semi‑join (concept):
- A semi‑join returns rows from the left table where a match exists on the right, but does not return right table columns.
- In SQL, this is usually written with `EXISTS` or `IN`.
- Real life example: show customers who have at least one paid order.

Semi‑join example:

```sql
SELECT c.id, c.name
FROM customers c
WHERE EXISTS (
  SELECT 1
  FROM orders o
  WHERE o.customer_id = c.id
    AND o.status = 'paid'
);
```

Rule of thumb:
- Large related table + existence check → `EXISTS`
- Need columns from both tables → `JOIN`
- Small list of values → `IN`

## Views

Use a view to save a reusable query.

```sql
CREATE VIEW v_customer_orders AS
SELECT c.name, o.id AS order_id, o.total_amount
FROM customers c
JOIN orders o ON o.customer_id = c.id;

SELECT * FROM v_customer_orders;
```

## CASE

Use CASE for conditional logic inside a query.

```sql
SELECT o.id,
  CASE
    WHEN o.total_amount >= 1000 THEN 'high'
    WHEN o.total_amount >= 500 THEN 'medium'
    ELSE 'low'
  END AS order_size
FROM orders o;
```

## Aggregations

Common functions:
- `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`

Basic aggregation:

```sql
SELECT COUNT(*) AS total_orders
FROM orders;
```

Group by:

```sql
SELECT customer_id, SUM(total_amount) AS total_spend
FROM orders
GROUP BY customer_id;
```

Group by + having:

```sql
SELECT customer_id, SUM(total_amount) AS total_spend
FROM orders
GROUP BY customer_id
HAVING SUM(total_amount) > 1000;
```

Multiple columns grouping:

```sql
SELECT customer_id, DATE_TRUNC('month', order_date) AS month, COUNT(*) AS orders
FROM orders
GROUP BY customer_id, DATE_TRUNC('month', order_date);
```

Aggregation with join:

```sql
SELECT c.name, SUM(o.total_amount) AS total_spend
FROM customers c
JOIN orders o ON o.customer_id = c.id
GROUP BY c.name;
```

## GROUP BY, HAVING, ORDER BY

- `GROUP BY`: groups rows so you can aggregate
- `HAVING`: filters groups after aggregation
- `ORDER BY`: sorts the final output

Example:

```sql
SELECT customer_id, SUM(total_amount) AS total_spend
FROM orders
GROUP BY customer_id
HAVING SUM(total_amount) > 1000
ORDER BY total_spend DESC;
```

Real life example: top customers by spend, only those above 1000.

## Loops (Procedural SQL)

Plain SQL does not have loops. Loops are in procedural languages like PL/pgSQL (Postgres) or T-SQL (SQL Server).

Postgres example:

```sql
DO $$
DECLARE i INT := 1;
BEGIN
  WHILE i <= 3 LOOP
    INSERT INTO logs(message) VALUES ('run ' || i);
    i := i + 1;
  END LOOP;
END $$;
```

SQL Server example:

```sql
DECLARE @i INT = 1;
WHILE @i <= 3
BEGIN
  INSERT INTO logs(message) VALUES (CONCAT('run ', @i));
  SET @i = @i + 1;
END;
```

How to remember loops:
- Postgres uses `LOOP` / `END LOOP`
- SQL Server uses `WHILE` with `BEGIN` / `END`
- MySQL uses `WHILE ... DO ... END WHILE`

## Advanced Topics

- Window functions: `ROW_NUMBER()`, `RANK()`, `LAG()`, `LEAD()`
- CTEs: `WITH ... AS (...)`
- Indexing: composite indexes and when they help
- Execution plans: find why queries are slow
- Transactions: isolation levels and consistency
- Locks and deadlocks: avoid blocking systems
- Upserts: `ON CONFLICT` (Postgres) or `MERGE` (SQL Server)
- Partitioning: split large tables by date/key
- Materialized views: precompute heavy queries

### Advanced Examples

Window function:

```sql
SELECT id, total_amount,
  ROW_NUMBER() OVER (ORDER BY total_amount DESC) AS rn
FROM orders;
```

Real life example: show top 10 customers by spend and their rank.

CTE:

```sql
WITH big_orders AS (
  SELECT * FROM orders WHERE total_amount > 1000
)
SELECT * FROM big_orders;
```

Real life example: calculate monthly sales, then filter only the months above target.

Composite index:

```sql
CREATE INDEX idx_orders_customer_date ON orders(customer_id, order_date);
```

Real life example: get a customer’s orders sorted by date on a busy e‑commerce site.

Execution plan:

```sql
EXPLAIN SELECT * FROM orders WHERE customer_id = 10;
```

Real life example: a report takes 20 seconds and you need to find the bottleneck.

Transaction:

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;
```

Real life example: transfer money between accounts without losing funds.

Upsert (Postgres):

```sql
INSERT INTO products(id, name)
VALUES (1, 'Phone')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
```

Real life example: syncing product data from an external system each night.

Partitioning (conceptual):

```sql
CREATE TABLE orders_2026 PARTITION OF orders
FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
```

Real life example: order history table with 200M rows, queries mostly by month.

Materialized view:

```sql
CREATE MATERIALIZED VIEW mv_sales AS
SELECT customer_id, SUM(total_amount) AS total
FROM orders
GROUP BY customer_id;
```

Real life example: sales dashboard that must load in under 1 second.

## Best Practices

- Always filter with WHERE to avoid full table scans.
- Select only the columns you need, not `SELECT *` in production.
- Use indexes on columns used in JOIN, WHERE, ORDER BY.
- Keep queries small and readable with aliases.
- Avoid correlated subqueries when a join works faster.
- Use LIMIT for testing large tables.

## Common Mistakes

- Joining on wrong keys (causes duplicate rows).
- Using functions on indexed columns in WHERE (breaks index usage).
- Forgetting GROUP BY when using aggregates.
- Using SELECT * in slow reports.

## What Else To Add

- Constraints: `PRIMARY KEY`, `FOREIGN KEY`, `UNIQUE`, `NOT NULL`
- Normalization basics and when to denormalize
- Index tuning and covering indexes
- Query plan reading with `EXPLAIN ANALYZE`
- Pagination patterns (offset vs keyset)
- Transactions and isolation levels in detail
- Stored procedures and triggers (if your DB uses them)

## Constraints

```sql
CREATE TABLE orders (
  id INT PRIMARY KEY,
  customer_id INT NOT NULL,
  order_date DATE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  UNIQUE (id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

Real life example: prevent orders without a customer or duplicate order ids.

## Normalization vs Denormalization

Normalization keeps data in separate tables to avoid duplication. Denormalization duplicates some data to speed reads.

Real life example:
- Normalize: customers table + orders table for clean data.
- Denormalize: store customer name in orders for fast reporting.

## Index Tuning (Covering Index)

```sql
CREATE INDEX idx_orders_customer_date_total
ON orders(customer_id, order_date, total_amount);
```

Real life example: dashboard queries that filter by customer and date and need total_amount without hitting the table.

## Query Plan Reading

```sql
EXPLAIN ANALYZE
SELECT * FROM orders WHERE customer_id = 10;
```

Real life example: figure out why a query is slow and which index is missing.

## Pagination Patterns

Offset pagination:
```sql
SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 40;
```

Keyset pagination:
```sql
SELECT * FROM orders WHERE id > 40 ORDER BY id LIMIT 20;
```

Real life example: keyset pagination is faster for large tables and infinite scroll.

## Transactions and Isolation Levels

Transactions group multiple changes so they succeed or fail together. Isolation levels control how much one transaction can see another's in‑progress work.

Real life example: banking uses higher isolation to avoid dirty reads or double‑spends.

## Stored Procedures and Triggers

Stored procedures are saved programs that run in the database. Triggers run automatically when a table changes.

Stored procedure example (SQL Server style):
```sql
CREATE PROCEDURE AddCustomer
  @name VARCHAR(100),
  @city VARCHAR(100)
AS
BEGIN
  INSERT INTO customers(name, city) VALUES (@name, @city);
END;
```

Trigger example:
```sql
CREATE TRIGGER orders_audit
AFTER INSERT ON orders
FOR EACH ROW
BEGIN
  INSERT INTO audit_log(table_name, action) VALUES ('orders', 'insert');
END;
```
