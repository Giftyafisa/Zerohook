---
name: qlik-cicd-version-control
description: >
  Implement version control and CI/CD pipelines for Qlik Sense. Covers
  Qlik Cloud native version control, Qlik-CLI automation, Git integration,
  Gitoqlok, and GitHub Actions/GitLab CI pipelines for automated app
  deployments across environments. Use when setting up automated deployment
  or source control for Qlik environments.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-deployment
---

# Qlik CI/CD & Version Control

## When to Use

- User asks how to version control Qlik Sense apps
- User wants to automate deployments from DEV to PROD
- User mentions Git, GitHub Actions, Jenkins, or GitLab CI
- User asks about Qlik-CLI (Command Line Interface)
- User needs to back up apps automatically

## Version Control Strategies

Qlik apps (.qvf) are binary files, making traditional Git diffs difficult. Here are the main strategies:

### 1. Qlik Cloud Native Version Control
Qlik Cloud has built-in version control in Shared Spaces.
- **Commit**: Right-click app → *Commit*. Saves a version with a message.
- **History**: Right-click app → *Version history*. Restore or export previous versions.
- *Best for*: Small teams exclusively using Qlik Cloud without external Git requirements.

### 2. Gitoqlok (Browser Extension)
A popular 3rd-party extension that integrates Git directly into the Qlik Sense UI (Cloud & QSEoW).
- Saves load scripts, variables, and UI objects as JSON/text to GitHub/GitLab.
- Allows visual diffs of script changes.
- *Best for*: Developers wanting Git inside the Qlik browser interface.

### 3. Qlik-CLI + External Git (Enterprise CI/CD)
Using Qlik's official command-line tool to serialize apps, export them, and push to Git repositories. This enables true CI/CD pipelines.

## Qlik-CLI Overview

`qlik-cli` is the official tool for interacting with Qlik Cloud REST APIs.

### Installation & Authentication
```bash
# Install (Mac/Linux)
brew install qlik/taps/qlik

# Authenticate (Requires API Key from Qlik Cloud Management Console)
qlik context init
# Enter Tenant URL: https://your-tenant.qlikcloud.com
# Enter API Key: <your-key>
```

### Basic Commands
```bash
# List apps in a space
qlik item ls --spaceId <space-id> --resourceType app

# Export an app to a QVF file (without data)
qlik app export <app-id> --NoData > my_app.qvf

# Import an app
qlik app import --file my_app.qvf --spaceId <target-space-id>

# Trigger reload
qlik reload create --appId <app-id>
```

## Building a CI/CD Pipeline

A standard Enterprise Qlik CI/CD workflow:

1. **Develop**: Developer works in DEV space.
2. **Commit**: Developer exports app (without data) and commits to Git.
3. **Build/Test (CI)**: Pipeline triggers, imports app to TEST space, triggers a reload, and runs data quality checks.
4. **Deploy (CD)**: Upon approval, pipeline publishes the app to the PROD managed space.

### Serializing Qlik Apps (App Unpacking)

Binary `.qvf` files can't be diffed in Git. Qlik provides `corectl` (part of Qlik Core) or the Qlik Application Automation to "unpack" an app into JSON and QVS files.

```bash
# Unpack a QVF into raw source files (JSON properties + Load script)
qlik app unbuild <app-id> --dir ./src/my_app

# The ./src/my_app folder can now be committed to Git!
# It contains:
# - script.qvs (Load Script)
# - properties.json (App metadata)
# - objects/ (UI sheets and charts as JSON)
```

To build it back:
```bash
# Build a new QVF from source files
qlik app build --dir ./src/my_app --app <new-app-id>
```

## Example Workflow (Git Branching)

1. **Feature Branch**: `feature/add-sales-kpis`
   - Developer unpacks app to `/src` and commits `script.qvs` and JSON changes.
2. **Pull Request**: Reviewed by team lead (Git diff shows exact script changes!).
3. **Merge to Main**: Triggers GitHub Action.
4. **GitHub Action**:
   - Rebuilds QVF from source.
   - Uses `qlik app import` to push to UAT space.
   - Uses `qlik reload create` to test data load.
5. **Release Tag**: Triggers production deployment via `qlik app publish`.

## Environment Variable Management

In CI/CD, the app must connect to DEV databases in DEV, and PROD databases in PROD. 

**Best Practice:** Do NOT change the script during deployment. 
Instead, use a standardized `config.qvs` pattern (see `qlik-master-items`) or Space-level Data Connections with identical names.

*Example:*
- DEV Space has connection `SQL_DB` pointing to `dev-db.internal`.
- PROD Space has connection `SQL_DB` pointing to `prod-db.internal`.
- The script just says `LIB CONNECT TO 'SQL_DB';`. When promoted to PROD, it automatically uses the PROD connection.

[See references/qlik-cli-cheatsheet.md for essential CLI commands]
[See assets/github-actions-pipeline.yml for a complete CI/CD template]
