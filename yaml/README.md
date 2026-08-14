# YAML Fundamentals - Syntax and Rules

This README is a short, practical guide to writing valid YAML (YAML Ain't Markup Language) files, covering common structures, rules, and best practices.

## Contents

- [Core Rules](#core-rules)
- [Basic Structures](#basic-structures)
- [Data Types](#data-types)
- [Multi-line Strings](#multi-line-strings)
- [Advanced Concepts (Anchors & Aliases)](#advanced-concepts)
- [Multi-Document Files](#multi-document-files)
- [Gotchas and Common Errors](#gotchas-and-common-errors)
- [Common Use Cases](#common-use-cases)

---

## Core Rules

1. **Indentation is everything**: YAML uses spacing to show structure.
   - Use spaces, **never tabs**.
   - Use a consistent number of spaces (typically 2 or 4 spaces) for each indentation level.
2. **Key-Value format**: Use a colon followed by a space: `key: value`.
3. **Case Sensitivity**: YAML is case-sensitive (`active`, `Active`, and `ACTIVE` are different keys).
4. **Comments**: Start comments with a `#`. There are no multi-line comments in YAML.

---

## Basic Structures

### 1. Maps / Key-Value Pairs (Objects)
A simple collection of key-value pairs:
```yaml
port: 8080
status: active
host: localhost
```

Nested objects are indented:
```yaml
database:
  host: 127.0.0.1
  port: 5432
  user: postgres
```

### 2. Lists / Sequences (Arrays)
Lists are represented by a dash `-` followed by a space:
```yaml
skills:
  - Git
  - SQL
  - YAML
```

You can also write inline lists (less common, but valid flow style):
```yaml
skills: [Git, SQL, YAML]
```

### 3. List of Maps
A very common structure in configurations (e.g. docker-compose, github workflows):
```yaml
users:
  - name: Alice
    role: Admin
  - name: Bob
    role: User
```

---

## Data Types

YAML automatically detects standard data types:

| Type | Syntax Example | Notes |
| :--- | :--- | :--- |
| **String** | `name: John Doe` or `title: "YAML Rules"` | Quotes are optional unless the string contains special characters like `:` or `[` |
| **Integer** | `port: 8080` | Whole numbers |
| **Float** | `version: 3.8` | Decimals |
| **Boolean** | `enabled: true` | Can be `true`/`false`, `yes`/`no`, or `on`/`off` (lowercase preferred) |
| **Null** | `config: null` | Can also use a tilde `~` or leave it empty |

---

## Multi-line Strings

If you have text spanning multiple lines, use either `|` or `>`:

### 1. Literal Block (`|`)
Preserves line breaks and spacing. Excellent for scripts or raw text.
```yaml
script: |
  echo "Starting build..."
  npm install
  npm run build
```

### 2. Folded Block (`>`)
Folds lines into a single paragraph by replacing newlines with spaces.
```yaml
description: >
  This is a very long sentence
  that will be read as a single
  paragraph in the output.
```

---

## Advanced Concepts

### 1. Anchors (`&`) and Aliases (`*`)
If you have repetitive blocks of configuration, you can define an anchor (`&name`) at the source and reuse it with an alias (`*name`). You can also use the merge key (`<<`) to import keys into the current map and override individual ones.

```yaml
# Define reusable settings
default_settings: &defaults
  adapter: postgres
  host: localhost
  username: admin

# Reuse them using aliases
development:
  database:
    <<: *defaults  # The '<<' merges all keys from 'defaults'
    database: dev_db

production:
  database:
    <<: *defaults
    database: prod_db
    host: prod-rds.amazonaws.com  # You can override specific keys!
```

### 2. Multi-Document Support (`---`)
A single `.yaml` file can contain multiple distinct documents. They are separated by three dashes (`---`). This is widely used in Kubernetes configurations to define multiple resources in one file.

```yaml
# Document 1 (Service config)
apiVersion: v1
kind: Service
metadata:
  name: web-service
---
# Document 2 (Deployment config)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-deployment
```

---

## Gotchas and Common Errors

### 1. Tabs vs Spaces
If you use tabs, YAML parser will throw an error like:
`found character '\t' that cannot start any token`
**Fix:** Configure your editor to convert tabs to spaces automatically.

### 2. Missing Space after Colon
This is invalid:
```yaml
port:8080 # Invalid!
```
**Fix:** Always include a space after the colon:
```yaml
port: 8080 # Valid
```

### 3. Special Characters in Strings
If your string contains characters like `:` or `{}` or `[]`, wrap it in quotes:
```yaml
# Invalid (due to colons)
message: Time: 12:00 PM

# Valid
message: "Time: 12:00 PM"
```

---

## Common Use Cases

### Docker Compose
```yaml
version: '3.8'
services:
  web:
    image: node:18-alpine
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
```

### GitHub Actions (Workflow)
```yaml
name: CI Workflow
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run test
        run: npm test
```
