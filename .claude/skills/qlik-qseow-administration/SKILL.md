---
name: qlik-qseow-administration
description: >
  Administer Qlik Sense Enterprise on Windows (QSEoW) with QMC operations,
  task management, security rules, streams, custom properties, virtual
  proxies, and QRS API automation. Covers on-premise specific patterns
  including certificate auth, task chains, content libraries, and
  monitoring. Use when managing a QSEoW environment.
license: Apache-2.0
platforms: ["client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-onprem
---

# QSEoW Administration

## When to Use

- User is working with Qlik Sense Enterprise on Windows (on-premise)
- User mentions QMC, QRS API, streams, tasks, or security rules
- User needs to automate QSEoW operations
- User asks about certificate authentication, virtual proxies, or custom properties
- User needs task scheduling, chaining, or monitoring on-prem

## QMC (Qlik Management Console)

The QMC is the web-based administration interface at `https://qlik-server/qmc`.

### Key QMC Areas

| Area | Purpose |
|---|---|
| **Apps** | Manage applications, publish, move between streams |
| **Streams** | Organize published apps (like folders) |
| **Tasks** | Reload scheduling and task chains |
| **Security Rules** | Fine-grained access control |
| **Custom Properties** | Tag apps/users/streams with metadata |
| **Data Connections** | Manage lib:// connections |
| **Users** | User directory sync and management |
| **Analytic Connections** | SSE endpoint configuration |
| **Virtual Proxies** | Authentication and routing |
| **Content Libraries** | Shared images, extensions, themes |

## Streams

Streams are the primary way to organize and secure published apps in QSEoW.

### Stream Strategy
```
Everyone (default)      → Company-wide apps
Sales                   → Sales team apps
Finance                 → Finance team apps  
IT Operations           → Technical/monitoring apps
Executive               → C-level dashboards
Development             → Testing/staging area
```

### Publishing Apps to Streams

1. **QMC → Apps** → Select app → **Publish**
2. Choose target stream
3. App is now read-only in the stream (original stays in personal workspace)

### Stream Security Rules

Default rule: Users see streams they have `Read` access to.

```
// Custom rule: Sales group sees Sales stream
Resource Filter: Stream_*
Conditions: user.group = "Sales" AND resource.name = "Sales"
Actions: Read
```

## Tasks (Reload Scheduling)

### Creating a Reload Task

1. **QMC → Tasks → Create new**
2. Configure:
   - **App**: Select the target app
   - **Name**: Descriptive name (e.g., "Daily Sales Extract - 6AM")
   - **Enabled**: Toggle on/off

### Task Triggers

| Trigger Type | Use Case |
|---|---|
| **Schema** | Time-based (daily, hourly, cron-like) |
| **Task event** | After another task completes (chaining) |
| **External** | Triggered via QRS API |
| **Composite** | Multiple conditions (AND/OR logic) |

### Task Chaining Pattern

```
Extract Task (6:00 AM)
    ↓ on success
Transform Task
    ↓ on success
├── Sales App Reload
├── Finance App Reload
└── Executive Dashboard Reload
```

Set up in QMC:
1. Create "Extract Task" with schema trigger (6:00 AM daily)
2. Create "Transform Task" with task event trigger → "On task successfully finished" → "Extract Task"
3. Create app reload tasks with task event trigger → "On task successfully finished" → "Transform Task"

### Task Monitoring

Check task status:
- **QMC → Tasks** — Shows last execution status, next run time
- **QMC → Task overview** — Grid view of all task statuses
- Status: `Success`, `Failed`, `Aborted`, `Running`, `Queued`

## Security Rules

QSEoW uses a fine-grained security rule engine.

### Rule Structure

```
Rule name: [descriptive name]
Resource filter: [what resource type]
Actions: [Create, Read, Update, Delete, Publish, etc.]
Conditions: [who and what]
Context: [Hub, QMC, Both]
```

### Common Security Rule Patterns

#### Give a Group Access to a Stream
```
Name: StreamAccess_Sales
Resource filter: Stream_*
Actions: Read
Conditions: user.group = "SalesTeam" AND resource.name = "Sales"
Context: Both (Hub and QMC)
```

#### Allow Users to Create Apps
```
Name: CreateApp_AllUsers
Resource filter: App_*
Actions: Create
Conditions: !user.IsAnonymous()
Context: Hub
```

#### Restrict QMC Access to Admins
```
Name: QMC_AdminOnly
Resource filter: *
Actions: Read
Conditions: user.group = "QlikAdmins"
Context: QMC
```

#### Custom Property-Based Access
```
// Apps tagged with custom property "Department" = "Sales"
// Only accessible by Sales users
Name: DeptAccess
Resource filter: App_*
Actions: Read
Conditions: user.@Department = resource.@Department
Context: Hub
```

### Security Rule Order

Rules are evaluated **additively** — if ANY rule grants access, the user has access. There is no "deny" rule. To restrict, ensure no rule grants the unwanted access.

## Custom Properties

Custom properties add metadata to resources for use in security rules and organization.

### Creating Custom Properties

1. **QMC → Custom properties → Create new**
2. Name: e.g., "Department"
3. Resource types: Apps, Streams, Users (select which can have this property)
4. Values: "Sales", "Finance", "IT", etc.

### Using in Security Rules

```
// User's Department must match App's Department
Conditions: user.@Department = resource.@Department
```

### Using in Scripts (via QRS API)

Custom properties on apps can be read via QRS API to drive dynamic behavior.

## QRS API (REST Management API)

The QRS API allows automation of all QMC operations.

### Authentication

QSEoW QRS API uses **certificate authentication** (mTLS):

```bash
# Required: client.pem, client_key.pem, root.pem
# Exported from QMC → Certificates

curl --cert client.pem --key client_key.pem --cacert root.pem \
  -H "X-Qlik-User: UserDirectory=INTERNAL;UserId=sa_api" \
  -H "X-Qlik-Xrfkey: abcdefghijklmnop" \
  "https://qlik-server:4242/qrs/app/full?xrfkey=abcdefghijklmnop"
```

### Common QRS API Calls

#### List All Apps
```bash
GET /qrs/app/full?xrfkey=XRFKEY
```

#### Get App by ID
```bash
GET /qrs/app/{appId}?xrfkey=XRFKEY
```

#### Trigger Reload Task
```bash
POST /qrs/task/{taskId}/start/synchronous?xrfkey=XRFKEY
```

#### Start Task by Name
```bash
# First find the task
GET /qrs/task?filter=name eq 'Daily Sales Reload'&xrfkey=XRFKEY

# Then start it
POST /qrs/task/{taskId}/start/synchronous?xrfkey=XRFKEY
```

#### Export App
```bash
POST /qrs/app/{appId}/export/{token}?xrfkey=XRFKEY
# token = a random GUID you generate
```

#### Import App
```bash
POST /qrs/app/upload?name=ImportedApp&xrfkey=XRFKEY
Content-Type: application/vnd.qlik.sense.app
Body: [binary QVF file]
```

#### Publish App to Stream
```bash
PUT /qrs/app/{appId}/publish?stream={streamId}&xrfkey=XRFKEY
```

#### Get Task Execution Results
```bash
GET /qrs/executionresult?filter=taskId eq {taskId}&orderby=startTime desc&top=5&xrfkey=XRFKEY
```

#### List Users
```bash
GET /qrs/user?xrfkey=XRFKEY
```

#### Create a Reload Task
```bash
POST /qrs/reloadtask/create?xrfkey=XRFKEY
Content-Type: application/json

{
  "task": {
    "app": {"id": "APP_ID"},
    "name": "My Reload Task",
    "taskType": 0,
    "enabled": true,
    "taskSessionTimeout": 1440,
    "maxRetries": 0
  },
  "compositeEvents": [],
  "schemaEvents": []
}
```

## Virtual Proxies

Virtual proxies handle authentication and routing.

### Common Authentication Methods

| Method | Use Case |
|---|---|
| **Windows (NTLM/Kerberos)** | Default, domain-joined browsers |
| **Header** | Reverse proxy authentication |
| **SAML** | SSO with identity providers |
| **JWT** | Token-based access (mashups, APIs) |
| **Anonymous** | Public-facing dashboards |

### Header Authentication Setup

For reverse proxy setups (NGINX, Apache, F5):

1. **QMC → Virtual proxies → Create new**
2. Authentication: Header
3. Header name: `X-Remote-User` (or your proxy's header)
4. User directory: `YOURCOMPANY`

## Certificate Management

### Exporting Certificates

1. **QMC → Certificates**
2. Enter machine name (or "localhost" for same server)
3. Export format: **PEM** (most compatible)
4. Files generated:
   - `client.pem` — Client certificate
   - `client_key.pem` — Client private key
   - `root.pem` — CA certificate

### Certificate Locations

Default paths on Qlik Sense server:
```
C:\ProgramData\Qlik\Sense\Repository\Exported Certificates\
C:\ProgramData\Qlik\Sense\Repository\Exported Certificates\.Local Certificates\
```

## Monitoring & Health

### Key Log Locations

```
C:\ProgramData\Qlik\Sense\Log\Repository\
C:\ProgramData\Qlik\Sense\Log\Engine\
C:\ProgramData\Qlik\Sense\Log\Proxy\
C:\ProgramData\Qlik\Sense\Log\Scheduler\
```

### Health Check Endpoint
```bash
GET https://qlik-server:4242/qrs/healthcheck?xrfkey=XRFKEY
```

### Service Status
```powershell
Get-Service Qlik* | Format-Table Name, Status
# QlikSenseRepositoryService, QlikSenseEngineService, 
# QlikSenseProxyService, QlikSenseSchedulerService,
# QlikSenseServiceDispatcher, QlikSensePrintingService
```

## Common Tasks Checklist

- [ ] Certificates exported for API access
- [ ] Streams created for each department/team
- [ ] Security rules configured per stream
- [ ] Reload tasks created with appropriate triggers
- [ ] Task chains set up for dependent reloads
- [ ] Custom properties defined for dynamic access control
- [ ] Virtual proxy configured for authentication method
- [ ] Monitoring/alerting for task failures
- [ ] User directory connector syncing
- [ ] Content library set up for shared resources

[See references/qrs-api-patterns.md for advanced API automation]
[See assets/ for script templates]
