# Qlik Cloud REST API Reference

## Authentication

All API calls require an API key or OAuth token:

```bash
# API Key (simplest)
-H "Authorization: Bearer YOUR_API_KEY"

# Generate API keys: Management Console → API keys → Generate new key
```

## Base URL

```
https://YOUR-TENANT.REGION.qlikcloud.com
```

Common regions: `us`, `eu`, `ap`, `uk`

---

## Apps API

### List Apps
```bash
GET /api/v1/items?resourceType=app&limit=100
```

### Get App Details
```bash
GET /api/v1/apps/{appId}
```

### Create App
```bash
POST /api/v1/apps
Content-Type: application/json

{
  "attributes": {
    "name": "My New App",
    "description": "Created via API",
    "spaceId": "SPACE_ID"
  }
}
```

### Copy App
```bash
POST /api/v1/apps/{appId}/copy
Content-Type: application/json

{
  "name": "App Copy",
  "spaceId": "TARGET_SPACE_ID"
}
```

### Delete App
```bash
DELETE /api/v1/apps/{appId}
```

### Export App (Without Data)
```bash
POST /api/v1/apps/{appId}/export

# Response includes a download URL
```

### Import App
```bash
POST /api/v1/apps/import
Content-Type: multipart/form-data

file: @app_export.qvf
spaceId: TARGET_SPACE_ID
name: Imported App
```

### Publish App to Managed Space
```bash
POST /api/v1/apps/{appId}/publish
Content-Type: application/json

{
  "spaceId": "MANAGED_SPACE_ID",
  "data": "source"
}
```

---

## Script API

### Get App Script
```bash
GET /api/v1/apps/{appId}/scripts
```

Response:
```json
{
  "script": "///$tab Main\nSET ThousandSep=',';\n..."
}
```

### Update App Script
```bash
PUT /api/v1/apps/{appId}/scripts
Content-Type: application/json

{
  "script": "///$tab Main\nSET ThousandSep=',';\n..."
}
```

---

## Reloads API

### Trigger Reload
```bash
POST /api/v1/reloads
Content-Type: application/json

{
  "appId": "APP_ID"
}
```

Response:
```json
{
  "id": "RELOAD_ID",
  "appId": "APP_ID",
  "status": "QUEUED"
}
```

### Get Reload Status
```bash
GET /api/v1/reloads/{reloadId}
```

Status values: `QUEUED`, `RELOADING`, `SUCCEEDED`, `FAILED`, `CANCELED`

### List Recent Reloads
```bash
GET /api/v1/reloads?appId=APP_ID&limit=10
```

### Cancel Reload
```bash
POST /api/v1/reloads/{reloadId}/actions/cancel
```

---

## Spaces API

### List Spaces
```bash
GET /api/v1/spaces?limit=100
```

### Create Space
```bash
POST /api/v1/spaces
Content-Type: application/json

{
  "name": "Production Apps",
  "description": "Governed production space",
  "type": "managed"
}
```

Type values: `shared`, `managed`, `data`

### Get Space Members
```bash
GET /api/v1/spaces/{spaceId}/assignments
```

### Add Member to Space
```bash
POST /api/v1/spaces/{spaceId}/assignments
Content-Type: application/json

{
  "type": "user",
  "assigneeId": "USER_ID",
  "roles": ["consumer"]
}
```

Role values: `consumer`, `contributor`, `dataconsumer`, `facilitator`, `producer`, `publisher`, `basicconsumer`

---

## Data Connections API

### List Connections
```bash
GET /api/v1/data-connections?limit=100
```

### Get Connection Details
```bash
GET /api/v1/data-connections/{connectionId}
```

---

## Users API

### Get Current User
```bash
GET /api/v1/users/me
```

### List Users
```bash
GET /api/v1/users?limit=100
```

---

## Common Patterns

### Poll for Reload Completion
```bash
# 1. Start reload
RELOAD_ID=$(curl -s -X POST .../api/v1/reloads \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"appId\": \"$APP_ID\"}" | jq -r '.id')

# 2. Poll until complete
while true; do
  STATUS=$(curl -s .../api/v1/reloads/$RELOAD_ID \
    -H "Authorization: Bearer $API_KEY" | jq -r '.status')
  
  echo "Status: $STATUS"
  
  if [ "$STATUS" = "SUCCEEDED" ] || [ "$STATUS" = "FAILED" ]; then
    break
  fi
  
  sleep 10
done
```

### Promote App Between Spaces
```bash
# 1. Copy from DEV to TEST
curl -X POST .../api/v1/apps/$APP_ID/copy \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$APP_NAME - TEST\", \"spaceId\": \"$TEST_SPACE_ID\"}"

# 2. Trigger reload in TEST (to use TEST connections)
curl -X POST .../api/v1/reloads \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"appId\": \"$TEST_APP_ID\"}"
```

### Bulk Export All Apps in a Space
```bash
# List apps in space
APPS=$(curl -s ".../api/v1/items?resourceType=app&spaceId=$SPACE_ID" \
  -H "Authorization: Bearer $API_KEY" | jq -r '.data[].resourceId')

for APP_ID in $APPS; do
  curl -X POST ".../api/v1/apps/$APP_ID/export" \
    -H "Authorization: Bearer $API_KEY" \
    -o "backup_${APP_ID}.qvf"
done
```

## Rate Limits

- Default: 100 requests per minute per user
- Reload API: Limited concurrent reloads per tenant (check your plan)
- Export/Import: May have size limits depending on tenant tier

## Error Handling

| Status | Meaning | Action |
|---|---|---|
| 401 | Unauthorized | Check API key / token expiration |
| 403 | Forbidden | Check space permissions |
| 404 | Not found | Verify appId / spaceId |
| 429 | Rate limited | Back off and retry |
| 500 | Server error | Retry with exponential backoff |
