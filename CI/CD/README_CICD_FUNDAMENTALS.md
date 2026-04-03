# CI/CD Fundamentals

This file gives a concise, real‑world view of CI/CD: what it is, what problems it solves, the problems it still faces, and the tradeoffs.

## What Is CI/CD

- CI (Continuous Integration): Automatically build and test every change before it is merged.
- CD (Continuous Delivery/Deployment): Automatically deliver or deploy changes after CI passes.

In practice, CI protects the codebase. CD protects the release.

## Problems CI/CD Fixes

- Prevents broken code from being merged
- Detects bugs early (before release)
- Reduces manual, error‑prone releases
- Creates repeatable, predictable deployments
- Gives fast feedback to developers

## Real‑World Problems CI/CD Still Faces

- Flaky tests (random failures break trust)
- Slow pipelines (developers wait too long)
- Secrets leaking into logs or repos
- Environment drift (staging behaves differently from prod)
- Branch drift (multi‑branch envs go out of sync)
- No rollback plan when deploy fails
- Rebuilding artifacts in each env (different binaries)
- Over‑privileged runners (security risk)
- Poor visibility (no clear “what deployed where”)

## Pros

- Faster feedback and higher code quality
- Safer, more consistent releases
- Easier collaboration in large teams
- Automated compliance and audit trails
- Faster incident response (know what changed)

## Cons / Tradeoffs

- Setup cost and maintenance effort
- Flaky tests can slow teams down
- Requires good test coverage to be effective
- Security risk if secrets and permissions are weak
- Pipelines can become complex without discipline

## Real‑World Scenarios (Short and Practical)

- A flaky test fails 1 out of 10 runs, blocking PRs and wasting time.
- A hotfix is merged but staging was behind, so prod gets unexpected code.
- A deploy fails and there is no rollback path, causing downtime.
- A secret is printed in logs and must be rotated immediately.
- A long pipeline (30+ minutes) forces developers to batch changes.

## What Good CI/CD Looks Like

- Fast PR checks (minutes, not hours)
- Consistent artifact promotion to staging/prod
- Clear approval gates for production
- Notifications on every deploy and failure
- Least‑privilege access for runners and secrets

## Why Companies Use Jenkins Even With GitHub Actions

- On‑prem or air‑gapped. Simple meaning: Jenkins runs inside the company network with no internet. Example: a bank is not allowed to send code to cloud CI.
- Compliance rules. Simple meaning: data must stay inside the company. Example: medical systems cannot upload builds or logs outside.
- Legacy tooling. Simple meaning: the company already has internal deploy tools. Example: Jenkins runs `\\corp-server\deploy\release.ps1`, a script that only exists inside the company network.
- Special hardware. Simple meaning: builds need machines GitHub does not provide. Example: GPU builds or licensed hardware dongles.
- Existing investment. Simple meaning: they already built everything on Jenkins. Example: hundreds of Jenkins jobs power releases and are too costly to move.

## Where Jenkins Runs (Simple)

- Jenkins is installed on a server the company controls (EC2, on‑prem, or a VM).
- Pipelines run on agents (machines) connected to Jenkins.

## How Jenkins Knows About GitHub Changes

- Webhook (most common): GitHub sends a message to Jenkins when code is pushed.
- Polling: Jenkins checks GitHub every few minutes for changes.

Example webhook flow:
1. You push code to GitHub.
2. GitHub sends a webhook to Jenkins.
3. Jenkins pulls the repo and runs the `Jenkinsfile`.

## More Real‑World Examples (Common Developer Tasks)

- Add a new check (lint/security) that must block merging.
- Speed up a slow pipeline by adding caching.
- Split monorepo pipelines so only affected services build.
- Create a manual approval step for production deploys.
- Roll back to the previous artifact after a failed release.

## Different Ways To Write CI/CD

- Branch‑based environments: `development` → `staging` → `main` deploys
- Single main + artifact promotion (enterprise standard)
- Monorepo with multiple pipelines per service
- Separate workflows: PR checks, deploys, security scans
- Reusable workflows to share common steps
- Jenkins pipelines (Jenkinsfile) for self‑hosted control

## CI/CD Platforms (Where You Write It)

- GitHub Actions: YAML workflows in `.github/workflows/*.yml`
- Jenkins: `Jenkinsfile` (Groovy pipeline)
- GitLab CI: `.gitlab-ci.yml`
- Azure DevOps: `azure-pipelines.yml`
- CircleCI: `.circleci/config.yml`
- Bitbucket Pipelines: `bitbucket-pipelines.yml`
- Travis CI: `.travis.yml`

## Examples (Short and Practical)

### Branch‑Based Environments

```yaml
on:
  push:
    branches: [ "development", "staging", "main" ]
```

### Single Main + Artifact Promotion

```yaml
on:
  push:
    branches: [ "main" ]
jobs:
  build_artifact:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Build once"
  deploy_dev:
    needs: [ build_artifact ]
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploy same artifact to Dev"
  deploy_prod:
    needs: [ deploy_dev ]
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploy same artifact to Prod"
```

### Monorepo (Multiple Pipelines)

```yaml
on:
  push:
    paths:
      - "services/api/**"
      - "services/web/**"
```

### Separate Workflows

```
.github/workflows/pr-checks.yml
.github/workflows/deploy-prod.yml
.github/workflows/security-scan.yml
```

### Reusable Workflows

```yaml
jobs:
  call_tests:
    uses: ./.github/workflows/reusable-tests.yml
```

### Jenkins Pipeline (Jenkinsfile)

```groovy
pipeline {
  agent any
  stages {
    stage('Build') { steps { sh 'npm run build' } }
    stage('Test') { steps { sh 'npm test' } }
    stage('Deploy') { steps { sh 'echo deploy' } }
  }
}
```
