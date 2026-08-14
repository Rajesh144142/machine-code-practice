# CI/CD Learning - GitHub Actions (CI/CD)

This README documents a GitHub Actions workflow that covers CI and CD with multiple environments, AI quality checks, and deployment notifications. It matches the requirements you shared: tests before deploy, optional AI checks for readability, branch-based environments, blocked merges on failure, and deploy notifications.

## Workflow File

You can use a single workflow file, but in real teams it is common to split CI/CD into multiple workflow files for clarity, speed, and ownership.

## Recommended File Split (Large Teams)

Create these files in your repository:

```
.github/workflows/pr-checks.yml
.github/workflows/deploy-dev.yml
.github/workflows/deploy-staging.yml
.github/workflows/deploy-prod.yml
.github/workflows/security-scan.yml
```

Why split:
- PR checks stay fast and focused
- Deploys are isolated by environment
- Security scans can run on a schedule
- Easier ownership across teams

## Split Workflows Examples (Recommended)

### PR Checks

File:
```
.github/workflows/pr-checks.yml
```

```yaml
name: PR Checks

on:
  pull_request:

jobs:
  pr_checks:
    runs-on: ubuntu-latest
    steps:
      # uses = run a reusable GitHub Action (prebuilt step)
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      # run = execute shell commands in the runner
      - name: Install deps
        run: npm ci
      - name: Build
        run: npm run build --if-present
      - name: Test
        run: npm test
      - name: Lint
        run: npm run lint --if-present
      - name: AI readability check (placeholder)
        run: |
          echo "Run your AI tool here"
          # Example: node tools/ai-review.js
```

### Development Deployment

File:
```
.github/workflows/deploy-dev.yml
```

```yaml
name: Deploy Dev

on:
  push:
    branches: [ "development" ]

jobs:
  deploy_dev:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Development
        run: echo "Deploying to Development environment..."
      - name: Notify
        run: echo "Notifying: Development deployment complete"
```

### Staging Deployment

File:
```
.github/workflows/deploy-staging.yml
```

```yaml
name: Deploy Staging

on:
  push:
    branches: [ "staging" ]

jobs:
  deploy_staging:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Staging
        run: echo "Deploying to Staging environment..."
      - name: Notify
        run: echo "Notifying: Staging deployment complete"
```

### Production Deployment

File:
```
.github/workflows/deploy-prod.yml
```

```yaml
name: Deploy Production

on:
  push:
    branches: [ "main" ]

jobs:
  deploy_prod:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Production
        run: echo "Deploying to Production environment..."
      - name: Notify
        run: echo "Notifying: Production deployment complete"
```

### Security Scan (Scheduled)

File:
```
.github/workflows/security-scan.yml
```

```yaml
name: Security Scan

on:
  schedule:
    - cron: "0 2 * * 1"

jobs:
  security_scan:
    runs-on: ubuntu-latest
    steps:
      - name: Scan dependencies
        run: echo "Running weekly security scan (Mondays at 02:00 UTC)"
```

## Single File Option

If you want everything in one file, create:

```
.github/workflows/ci-cd.yml
```

## Workflow Content

```yaml
name: CI-CD

on:
  pull_request:
  push:
    branches: [ "development", "staging", "main" ]

jobs:
  # PR checks: build, test, lint, AI readability
  pr_checks:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      # uses = run a reusable GitHub Action (prebuilt step)
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      # run = execute shell commands in the runner
      - name: Install deps
        run: npm ci

      - name: Build
        run: npm run build --if-present

      - name: Test
        run: npm test

      - name: Lint
        run: npm run lint --if-present

      - name: AI readability check (placeholder)
        run: |
          echo "Run your AI tool here"
          # Example: node tools/ai-review.js

  # Push checks: run before deploys on branch pushes
  push_checks:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      # uses = run a reusable GitHub Action (prebuilt step)
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      # run = execute shell commands in the runner
      - name: Install deps
        run: npm ci
      - name: Build
        run: npm run build --if-present
      - name: Test
        run: npm test
      - name: Lint
        run: npm run lint --if-present

  # Deploy to Development
  deploy_dev:
    if: github.ref == 'refs/heads/development'
    needs: [ push_checks ]
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Development
        run: echo "Deploying to Development environment..."
      - name: Notify
        run: echo "Notifying: Development deployment complete"

  # Deploy to Staging
  deploy_staging:
    if: github.ref == 'refs/heads/staging'
    needs: [ push_checks ]
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Staging
        run: echo "Deploying to Staging environment..."
      - name: Notify
        run: echo "Notifying: Staging deployment complete"

  # Deploy to Production
  deploy_prod:
    if: github.ref == 'refs/heads/main'
    needs: [ push_checks ]
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Production
        run: echo "Deploying to Production environment..."
      - name: Notify
        run: echo "Notifying: Production deployment complete"
```

## What It Does

- Runs CI checks on every pull request.
- Runs deployments on branch push.
- Uses Node.js 20 and `npm ci` for clean installs.
- Builds, tests, and lints before any deployment.
- Runs an AI readability step where you can attach your AI tool.
- Deploys to different environments based on branch.
- Notifies after each deployment.

## Branches And Environments

- `development` → Development environment
- `staging` → Staging environment
- `main` → Production environment

## Two Common CI/CD Models (Learn Both)

Model A is branch-based environments and is easiest to learn. Model B is the large-company standard with a single mainline and artifact promotion.

## Model A: Branch-Based Environments (Learning-Friendly)

How it works:
- Merge to `development` → deploy to Development
- Merge to `staging` → deploy to Staging
- Merge to `main` → deploy to Production

When to use:
- Small teams or training
- Simple mapping between branches and environments

Notes:
- You can auto-create PRs from `development` → `staging` and `staging` → `main`, but large teams usually prefer manual approvals.

## Model B: Single Main + Promote Same Artifact (Large-Team Standard)

How it works:
- All PRs merge into `main`
- CI builds once and creates an artifact
- The same artifact is promoted to Development, Staging, Production
- Staging and Production usually require approvals

Why large teams prefer it:
- No branch drift
- Same tested build goes to every environment
- Easier compliance and audit

## Model B Example (Single Main + Promotions)

```yaml
name: CI-CD-Promote

on:
  pull_request:
  push:
    branches: [ "main" ]

jobs:
  pr_checks:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: Install deps
        run: npm ci
      - name: Build
        run: npm run build --if-present
      - name: Test
        run: npm test
      - name: Lint
        run: npm run lint --if-present

  push_checks:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: Install deps
        run: npm ci
      - name: Build
        run: npm run build --if-present
      - name: Test
        run: npm test
      - name: Lint
        run: npm run lint --if-present

  build_artifact:
    if: github.ref == 'refs/heads/main'
    needs: [ push_checks ]
    runs-on: ubuntu-latest
    steps:
      - name: Build artifact
        run: echo "Build and publish artifact here"

  deploy_dev:
    if: github.ref == 'refs/heads/main'
    needs: [ build_artifact ]
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Development
        run: echo "Deploying same artifact to Development"

  deploy_staging:
    if: github.ref == 'refs/heads/main'
    needs: [ deploy_dev ]
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Staging
        run: echo "Deploying same artifact to Staging"

  deploy_prod:
    if: github.ref == 'refs/heads/main'
    needs: [ deploy_staging ]
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Production
        run: echo "Deploying same artifact to Production"
```

## Blocking Merges When Builds Fail

Use GitHub branch protection rules:
- Require status checks to pass before merging
- Select the `pr_checks` job

If tests or build fail, the PR cannot be merged.

## Extra Checks Only For Main (Before Merge)

If you want additional checks only when merging to `main`, add a main-only step or job.

Example step inside PR checks:

```yaml
- name: Main-only security gate
  if: github.base_ref == 'main'
  run: echo "Run extra checks for main only"
```

Example job:

```yaml
main_gate:
  if: github.base_ref == 'main'
  runs-on: ubuntu-latest
  steps:
    - name: Extra tests for main
      run: echo "Run heavy tests here"
```

Then in GitHub branch protection for `main`, require the `main_gate` status check.

## Large Team Standard (Recommended)

For large teams, this is the safest and most common setup:
- Require PR checks before merging
- Require branches to be up to date
- Use a merge queue
- Use environment protection for production
- Use CODEOWNERS for sensitive files

## GitHub Settings Steps (Do This In Your Repo)

1. Go to repo **Settings** → **Branches** → **Add branch protection rule**.
2. Branch pattern: `main`.
3. Enable **Require a pull request before merging**.
4. Enable **Require status checks to pass before merging** and select `pr_checks`.
5. Enable **Require branches to be up to date before merging**.
6. Optional: Enable **Require review from Code Owners**.
7. Optional: Enable **Require conversation resolution**.
8. Repeat steps 1–5 for `staging` and `development`.
9. To prevent direct pushes to `staging` and `main`, enable **Restrict who can push to matching branches** and allow only admins or a CI bot.
10. Go to **Settings** → **Rules** → **Rulesets** (or **Environments**) and create environments `development`, `staging`, `production`.
11. For `production`, add **required reviewers** for approvals.
12. Enable **Merge Queue** for `main` if available in your GitHub plan.

## Notifications

The workflow includes simple `echo` placeholders. Replace them with real notifications:
- Slack or Microsoft Teams webhook
- Email via a notification action
- GitHub comment to the PR

## Where To Plug In AI Tools

Add your AI reviewer in the `AI readability check` step. Examples:
- Run a script that comments on readability
- Run a static analysis tool enhanced by AI
- Post feedback to the PR as a comment

## Other Things Commonly Needed In CI/CD

- Secrets management for API keys and deploy credentials
- Environment protection rules for `staging` and `production`
- Approval gates for production deploys
- Caching dependencies to speed up builds
- Artifacts for build outputs and test reports
- Security scans for dependencies and containers
- Rollback plan for failed deployments
- Versioning and changelog generation
- Monitoring and alerting after deploys

## Reusable Workflows (How To Link YAML Files)

You cannot put two workflows in the same YAML file. Instead, create two separate files and make one call the other.

Reusable workflow (callee):

```yaml
# .github/workflows/reusable-tests.yml
name: Reusable Tests

on:
  workflow_call:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "Run tests here"
```

Caller workflow:

```yaml
# .github/workflows/pr-checks.yml
name: PR Checks

on:
  pull_request:

jobs:
  call_tests:
    uses: ./.github/workflows/reusable-tests.yml
```

## Running a Particular File/Script

In GitHub Actions, you use the `run` command inside a job step. The runner's shell environment executes it (Bash on Linux/macOS, PowerShell on Windows).

### 1. Running a JavaScript / Node.js File
Ensure dependencies are installed before running scripts:
```yaml
      - name: Install dependencies
        run: npm ci

      - name: Run specific migration script
        run: node scripts/db-migration.js
```

### 2. Running a Python Script
```yaml
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'

      - name: Run script
        run: python scripts/process_data.py
```

### 3. Running a Shell Script (`.sh`)
You must make the script executable (`chmod +x`) on Linux runners first:
```yaml
      - name: Run shell script
        run: |
          chmod +x scripts/deploy.sh
          ./scripts/deploy.sh
```

---

## Next Practice

Try modifying the workflow to:
- use Node.js 18
- add a `security_scan` step with a placeholder `echo`
- make deploy jobs run only after tests with `needs`

Then I will review it.
