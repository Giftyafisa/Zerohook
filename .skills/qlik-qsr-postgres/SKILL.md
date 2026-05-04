---
name: qlik-qsr-postgres
description: >
  Directly query the Qlik Sense Enterprise on Windows (QSEoW) PostgreSQL
  Repository Database (QSR). Covers connection setup with pgAdmin, standard
  query patterns for auditing (apps, users, reload tasks, security rules),
  and identifying orphaned resources. Use for deep system administration
  and custom monitoring dashboards on-premise.
license: Apache-2.0
platforms: ["client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-onprem
---

# Qlik QSR PostgreSQL Database

## When to Use

- User needs to audit QSEoW (on-premise) users, apps, or reload tasks
- User asks how to query the Qlik Sense Repository (QSR) database
- User mentions PostgreSQL, pgAdmin, or direct database access
- User wants to build a custom monitoring dashboard for their Qlik environment
- User needs to find orphaned apps or misconfigured security rules

## Overview

Qlik Sense Enterprise on Windows uses a PostgreSQL database (the QSR) to store all its metadata (apps, tasks, users, streams, custom properties).

While the QRS API is the recommended way to *modify* data, directly querying the PostgreSQL database is often the fastest way to *read* massive amounts of audit data for monitoring dashboards.

> **WARNING:** **NEVER write (INSERT/UPDATE/DELETE) directly to the QSR database.** It will corrupt your Qlik Sense environment and void your support contract. The QSR is strictly **READ-ONLY** for administrators.

## Connecting to the QSR

### Default Credentials
If you used the default embedded PostgreSQL database during installation:
- **Host**: `localhost` (or the Central Node server name)
- **Port**: `4432`
- **Database Name**: `QSR`
- **Username**: `qliksenserepository`
- **Password**: The password you defined during Qlik Sense installation.

### Accessing via pgAdmin (or Qlik Script)
To connect from another machine or from a Qlik load script, you must configure PostgreSQL to accept remote connections.

1. On the Central Node, open `C:\ProgramData\Qlik\Sense\Repository\PostgreSQL\<version>\pg_hba.conf`
2. Add a line to allow your IP:
   `host all all 10.0.0.50/32 md5`
3. Open `postgresql.conf` in the same folder.
4. Ensure `listen_addresses = '*'`
5. Restart the **Qlik Sense Repository Database** service.

## Key Tables

| Table | Description |
|---|---|
| `"Apps"` | All applications, published status, owner, stream |
| `"Users"` | All synced users, directory, inactive status |
| `"ReloadTasks"` | Reload task definitions, app links |
| `"ExecutionResults"` | History of task executions (success/fail/time) |
| `"Streams"` | Stream names and owners |
| `"SystemRules"` | Security rules |
| `"CustomPropertyDefinitions"` | Defined custom properties |

## Useful Query Patterns

### 1. App Inventory (Apps, Owners, Streams)
```sql
SELECT 
    a."ID" as "AppID",
    a."Name" as "AppName",
    a."Published",
    a."PublishTime",
    a."FileSize" / 1048576 as "FileSizeMB",
    u."UserId" as "OwnerID",
    u."UserDirectory",
    s."Name" as "StreamName"
FROM "Apps" a
LEFT JOIN "Users" u ON a."Owner_ID" = u."ID"
LEFT JOIN "Streams" s ON a."Stream_ID" = s."ID"
WHERE a."Deleted" = false;
```

### 2. Task Execution History (Failures)
```sql
SELECT 
    t."Name" as "TaskName",
    a."Name" as "AppName",
    e."StartTime",
    e."StopTime",
    e."Duration",
    CASE e."Status"
        WHEN 0 THEN 'NeverStarted'
        WHEN 1 THEN 'Triggered'
        WHEN 2 THEN 'Started'
        WHEN 3 THEN 'Queued'
        WHEN 4 THEN 'AbortInitiated'
        WHEN 5 THEN 'Aborting'
        WHEN 6 THEN 'Aborted'
        WHEN 7 THEN 'Success'
        WHEN 8 THEN 'Fail'
        WHEN 9 THEN 'Skipped'
        WHEN 10 THEN 'Retry'
        WHEN 11 THEN 'Error'
        WHEN 12 THEN 'Reset'
    END as "StatusMessage",
    e."Details"
FROM "ExecutionResults" e
JOIN "ReloadTasks" t ON e."ReloadTask_ID" = t."ID"
JOIN "Apps" a ON t."App_ID" = a."ID"
WHERE e."Status" NOT IN (7, 9) -- Not Success or Skipped
ORDER BY e."StartTime" DESC
LIMIT 100;
```

### 3. Identify Unused / Orphaned Apps
Apps that haven't been reloaded in 90 days, or apps owned by deleted/inactive users.

```sql
SELECT 
    a."Name" as "AppName",
    a."LastReloadTime",
    u."UserId" as "Owner",
    u."Inactive" as "IsOwnerInactive"
FROM "Apps" a
LEFT JOIN "Users" u ON a."Owner_ID" = u."ID"
WHERE a."Deleted" = false
  AND a."Published" = false
  AND (a."LastReloadTime" < NOW() - INTERVAL '90 days' OR u."Inactive" = true)
ORDER BY a."LastReloadTime" ASC;
```

### 4. Custom Property Assignments on Apps
Custom properties are stored in a many-to-many relationship table.

```sql
SELECT 
    a."Name" as "AppName",
    cpd."Name" as "PropertyName",
    cpv."Value" as "PropertyValue"
FROM "Apps" a
JOIN "AppCustomProperties" acp ON a."ID" = acp."App_ID"
JOIN "CustomPropertyValues" cpv ON acp."CustomPropertyValue_ID" = cpv."ID"
JOIN "CustomPropertyDefinitions" cpd ON cpv."Definition_ID" = cpd."ID"
WHERE a."Deleted" = false;
```

## Creating a Qlik Monitor App

To build a monitoring app inside Qlik Sense:

1. Create an **ODBC Connection** (or OLEDB) to the PostgreSQL database.
   - Driver: PostgreSQL
   - Host: `<CentralNodeIP>`
   - Port: 4432
   - DB: QSR
   - User: `qliksenserepository`
2. Load the SQL scripts directly into the Qlik load script.
3. Build a dashboard to track failed reloads, app sizes, and inactive users.

*Note: Qlik provides a free "Operations Monitor" app in the `Default` stream that does this via the Qlik REST API, but querying PostgreSQL is often faster for custom ad-hoc analysis.*

[See references/qsr-schema.md for table relationships]
[See assets/qsr-monitor.qlik for the Qlik load script to pull audit data]
