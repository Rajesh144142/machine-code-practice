# CI/CD Learning - Jenkins (Fundamentals)

This README is the starting point for learning Jenkins CI/CD. We will begin with fundamentals and expand step by step.

## What Is Jenkins

Jenkins is a self-hosted automation server used for CI/CD. You define pipelines in a `Jenkinsfile` and Jenkins runs them on agents.

## Where Jenkins Runs (General Flow)

1. Jenkins is installed on a server (EC2 or on‑prem).
2. A Jenkins job points to your GitHub repo.
3. GitHub sends a webhook (or Jenkins polls).
4. Jenkins pulls the repo and reads the `Jenkinsfile`.
5. Jenkins runs stages on agents and reports results.

## Core Concepts

- Job: A configured task Jenkins runs (freestyle or pipeline)
- Pipeline: Code-defined CI/CD process (recommended)
- Agent: The machine (OS) that runs your pipeline steps
- Stage: A named phase (Build, Test, Deploy)
- Step: A single command inside a stage

## What Is An Agent (OS Clarification)

An agent is the actual machine or OS that runs your commands. It can be Linux, Windows, macOS, or a Docker container. You can label agents by OS and target them.

Example:

```groovy
agent { label 'linux' }
```

This tells Jenkins to run the pipeline on a Linux agent.

## GitHub Actions Comparison

In GitHub Actions, `runs-on: ubuntu-latest` means the job runs on a Linux (Ubuntu) runner. That is similar to choosing a Linux agent in Jenkins.

## Basic Pipeline Example

Create a `Jenkinsfile` in your repo:

```groovy
pipeline {
  agent any

  stages {
    stage('Build') {
      steps {
        sh 'npm run build'
      }
    }

    stage('Test') {
      steps {
        sh 'npm test'
      }
    }
  }
}
```

## What This Does

- Runs on any available agent
- Builds the project
- Runs tests

## CI Steps With 3 Branches (development, staging, main)

Goal: run CI checks on all branches, and treat branches as different environments.

### Recommended CI Steps (Same for All Branches)

1. Checkout code
2. Install dependencies
3. Build
4. Test
5. Lint or static checks

### Example Jenkinsfile (Branch-Aware CI)

```groovy
pipeline {
  agent any

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install') {
      steps {
        sh 'npm ci'
      }
    }

    stage('Build') {
      steps {
        sh 'npm run build --if-present'
      }
    }

    stage('Test') {
      steps {
        sh 'npm test'
      }
    }

    stage('Lint') {
      steps {
        sh 'npm run lint --if-present'
      }
    }

    stage('Branch Info') {
      steps {
        echo "Branch: ${env.BRANCH_NAME}"
      }
    }
  }
}
```

### How This Maps To 3 Branches

- `development` → run CI checks for dev environment
- `staging` → run CI checks for staging environment
- `main` → run CI checks for production environment

## Running a Particular File/Script

In Jenkins pipeline scripts (defined in a `Jenkinsfile`), you execute commands inside a `steps` block using shell/terminal directives.

### 1. Linux/Unix Agents (`sh`)
Use the `sh` step to execute Unix commands:
```groovy
    stage('Run Script') {
      steps {
        // Run Node.js script
        sh 'node scripts/db-migration.js'

        // Run Python script
        sh 'python scripts/process_data.py'

        // Make executable and run shell script
        sh 'chmod +x scripts/deploy.sh && ./scripts/deploy.sh'
      }
    }
```

### 2. Windows Agents (`bat` or `powershell`)
On Windows agents, use `bat` or `powershell` directives:
```groovy
    stage('Run Script on Windows') {
      steps {
        // Using Command Prompt (bat)
        bat 'node scripts\\db-migration.js'

        // Using PowerShell
        powershell 'node scripts/db-migration.js'
      }
    }
```

---

## Next Steps (We Will Add Later)

- Branch-based rules (dev/staging/main)
- Environment variables and credentials
- Deployment stages
- Notifications
- Multibranch pipelines
- Approvals for production
- Parallel tests and caching
