# QRS API Automation Patterns

## Authentication Setup

All QRS API calls require:
1. **Client certificates** (mTLS) — exported from QMC
2. **X-Qlik-Xrfkey header** — 16-char alphanumeric string (must match `xrfkey` query param)
3. **X-Qlik-User header** — `UserDirectory=INTERNAL;UserId=sa_api` (or your service account)

```bash
# Base curl pattern
CERT="--cert client.pem --key client_key.pem --cacert root.pem"
HEADERS='-H "X-Qlik-User: UserDirectory=INTERNAL;UserId=sa_api" -H "X-Qlik-Xrfkey: abcdefghijklmnop"'
BASE="https://qlik-server:4242/qrs"
XRF="xrfkey=abcdefghijklmnop"
```

## App Management

### List All Apps (Summary)
```bash
GET /qrs/app?$XRF
```

### List All Apps (Full Details)
```bash
GET /qrs/app/full?$XRF
```

### Get App by Name
```bash
GET /qrs/app?filter=name eq 'Sales Dashboard'&$XRF
```

### Publish App to Stream
```bash
PUT /qrs/app/{appId}/publish?stream={streamId}&name=Published App Name&$XRF
```

### Replace Published App
```bash
PUT /qrs/app/{targetAppId}/replace?app={sourceAppId}&$XRF
```

### Delete App
```bash
DELETE /qrs/app/{appId}&$XRF
```

### Export App
```bash
# Generate a token (any GUID)
POST /qrs/app/{appId}/export/$(uuidgen)?$XRF

# Response contains downloadPath — fetch it
GET {downloadPath}?$XRF > exported_app.qvf
```

### Import App
```bash
POST /qrs/app/upload?name=MyApp&$XRF
Content-Type: application/vnd.qlik.sense.app
Body: [binary .qvf file]
```

## Task Management

### List All Tasks
```bash
GET /qrs/reloadtask/full?$XRF
```

### Get Task by Name
```bash
GET /qrs/reloadtask?filter=name eq 'Daily Sales Reload'&$XRF
```

### Start a Task (Synchronous — Waits for Completion)
```bash
POST /qrs/task/{taskId}/start/synchronous?$XRF
```

### Start a Task (Asynchronous — Returns Immediately)
```bash
POST /qrs/task/{taskId}/start?$XRF
```

### Get Last Execution Result
```bash
GET /qrs/executionresult?filter=taskId eq guid'{taskId}'&orderby=startTime desc&top=1&$XRF
```

### Get All Failed Tasks (Last 24 Hours)
```bash
GET /qrs/executionresult?filter=status eq 8 and startTime ge '$(date -d "yesterday" +%Y-%m-%dT%H:%M:%S.000Z)'&$XRF
```

Status codes: 0=NeverStarted, 1=Triggered, 2=Started, 3=Queued, 4=AbortInitiated, 5=Aborting, 6=Aborted, 7=Success, 8=Fail, 9=Skipped, 10=Retry, 11=Error, 12=Reset

## Stream Management

### List Streams
```bash
GET /qrs/stream/full?$XRF
```

### Create Stream
```bash
POST /qrs/stream?$XRF
Content-Type: application/json

{"name": "New Stream"}
```

### Delete Stream
```bash
DELETE /qrs/stream/{streamId}?$XRF
```

## User Management

### List All Users
```bash
GET /qrs/user?$XRF
```

### Search Users
```bash
GET /qrs/user?filter=name eq 'John Smith'&$XRF
GET /qrs/user?filter=userDirectory eq 'MYDOMAIN' and userId eq 'jsmith'&$XRF
```

### Get User Access Allocation
```bash
GET /qrs/license/accesstypeinfo?$XRF
```

## Custom Properties

### List Custom Properties
```bash
GET /qrs/custompropertydefinition/full?$XRF
```

### Set Custom Property on App
```bash
PUT /qrs/app/{appId}?$XRF
Content-Type: application/json

{
  "customProperties": [
    {
      "definition": {"id": "PROPERTY_DEF_ID"},
      "value": "Sales"
    }
  ]
}
```

## Automation Scripts

### PowerShell: Trigger Task and Wait
```powershell
$cert = Get-PfxCertificate -FilePath "client.pfx"
$xrfkey = "abcdefghijklmnop"
$baseUrl = "https://qlik-server:4242/qrs"

# Start task
$taskId = "YOUR-TASK-GUID"
Invoke-RestMethod -Uri "$baseUrl/task/$taskId/start?xrfkey=$xrfkey" `
    -Method Post `
    -Certificate $cert `
    -Headers @{"X-Qlik-User"="UserDirectory=INTERNAL;UserId=sa_api"; "X-Qlik-Xrfkey"=$xrfkey}

# Poll for completion
do {
    Start-Sleep -Seconds 10
    $result = Invoke-RestMethod -Uri "$baseUrl/executionresult?filter=taskId eq guid'$taskId'&orderby=startTime desc&top=1&xrfkey=$xrfkey" `
        -Certificate $cert `
        -Headers @{"X-Qlik-User"="UserDirectory=INTERNAL;UserId=sa_api"; "X-Qlik-Xrfkey"=$xrfkey}
    $status = $result.status
    Write-Host "Status: $status"
} while ($status -lt 6)

if ($status -eq 7) { Write-Host "Task succeeded" }
else { Write-Host "Task failed with status $status" }
```

### Batch Export All Apps
```bash
#!/bin/bash
APPS=$(curl -s $CERT $HEADERS "$BASE/app?$XRF" | jq -r '.[].id')

for APP_ID in $APPS; do
    TOKEN=$(uuidgen)
    DOWNLOAD=$(curl -s $CERT $HEADERS -X POST "$BASE/app/$APP_ID/export/$TOKEN?$XRF" | jq -r '.downloadPath')
    curl -s $CERT $HEADERS "$BASE$DOWNLOAD?$XRF" > "backup_${APP_ID}.qvf"
    echo "Exported: $APP_ID"
done
```

## Filter Syntax

QRS API uses OData-like filters:

| Operator | Example |
|---|---|
| `eq` | `name eq 'Sales'` |
| `ne` | `status ne 7` |
| `gt`, `ge` | `startTime ge '2024-01-01'` |
| `lt`, `le` | `fileSize le 1000000` |
| `and`, `or` | `name eq 'Sales' and published eq true` |
| `not` | `not published eq true` |
| `substring` | `name sw 'Sales'` (starts with) |
