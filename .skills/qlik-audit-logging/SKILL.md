---
name: qlik-audit-logging
description: >
  Implement audit logging and usage tracking in Qlik Cloud and QSEoW.
  Covers the Qlik Cloud Audit API, the Operations Monitor app, log file
  parsing, tracking user logins, app exports, and permission changes.
  Use when building compliance reports or monitoring system health.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-admin
---

# Qlik Audit Logging & Monitoring

## When to Use

- User needs to know who accessed an app or exported data
- User asks how to track failed reloads or slow performance
- User wants to build a custom usage dashboard
- User mentions "Audit API", "Operations Monitor", or log files
- User needs to meet compliance requirements for data access

## Qlik Cloud Audit API

In Qlik Cloud, all administrative and user actions are logged to the Audit API. These logs are retained for **90 days**. If you need them longer for compliance, you must extract and store them externally.

### Common Audit Events
- `com.qlik.login`: User authenticated
- `com.qlik.app.open`: User opened an app
- `com.qlik.app.export`: User exported an app to QVF
- `com.qlik.data.export`: User downloaded a chart to Excel
- `com.qlik.space.member.add`: Admin added a user to a space

### Extracting Audit Logs (Best Practice)
1. Generate an API Key in the Management Console.
2. Use a Qlik Application Automation (or a scheduled script) to call `GET /api/v1/audits`.
3. Store the resulting JSON in a Cloud Storage provider (AWS S3, Azure Blob) or a database.
4. Build a Qlik app to load that historical data.

*Alternatively, install the free **App Analyzer** or **Entitlement Analyzer** apps provided by Qlik, which handle this extraction automatically.*

## QSEoW (On-Premise) Log Files

In Qlik Sense Enterprise on Windows, every microservice writes detailed log files to the central file share.

**Default Path:** `\\<CentralNode>\QlikShare\ArchivedLogs`

### Key Log Folders

| Service | Log Type | What it tracks |
|---|---|---|
| **Engine** | Audit | Who opened which app, session durations, memory usage per app |
| **Engine** | Performance | CPU/RAM utilization of the Qlik engine |
| **Proxy** | Audit | User logins, IP addresses, session timeouts |
| **Scheduler** | System | Reload task successes and failures |
| **Repository** | Audit | Security rule changes, app publishes, owner changes |

### The Operations Monitor App

QSEoW comes with a built-in app called the **Operations Monitor** (found in the `Monitoring apps` stream).

- It automatically loads the archived log files.
- It provides dashboards for:
  - Active users and session concurrency
  - Reload task success rates and durations
  - Hardware performance (CPU/RAM spikes)
  - Error and warning logs across all nodes

*If the Operations Monitor stops updating, check the `monitor_apps_REST_task` data connections in the QMC to ensure the service account credentials are correct.*

## Tracking Data Exports (Compliance)

A common requirement is tracking when users export sensitive data to Excel.

**Qlik Cloud:**
Query the Audit API for `source=com.qlik.export` and `action=create`. The event payload contains the `userId`, `appId`, and `objectId` (the specific chart they exported).

**QSEoW:**
1. Open the `Engine/Audit` log file.
2. Look for the `Command=ExportData` entry.
3. The log line contains the `User`, `App Id`, and the time of export.

## Building a Custom Reload Dashboard

While the Operations Monitor is great, many admins prefer a custom, simple dashboard just for failed reloads.

**QSEoW Approach:**
Query the PostgreSQL Repository Database directly (see `qlik-qsr-postgres` skill).

**Qlik Cloud Approach:**
Use the `/api/v1/reloads` REST endpoint in a load script:
```qlik
LIB CONNECT TO 'QlikCloud_API';

RestConnectorMasterTable:
SQL SELECT 
    "id",
    "appId",
    "status",
    "startTime",
    "endTime",
    "duration"
FROM JSON (wrap on) "data"
WITH CONNECTION (URL "https://your-tenant.qlikcloud.com/api/v1/reloads");
```

[See references/audit-api-cheatsheet.md for Cloud REST API endpoints]
[See assets/log-parser.qlik for parsing QSEoW flat files]
