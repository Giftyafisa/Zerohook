# Audit API Reference

The Qlik Cloud Audit API (`/api/v1/audits`) provides a unified, searchable stream of events.

## Endpoints

### Get Events
`GET /api/v1/audits`

Retrieve the latest events. By default, it returns the last 24 hours of events, up to 100 items.

**Parameters:**
- `limit`: Number of events (default: 100)
- `sort`: Order by timestamp (`+eventTime` or `-eventTime`)
- `source`: Filter by the microservice that generated the event (e.g., `com.qlik.login`)
- `action`: Filter by the action taken (e.g., `create`, `update`, `delete`)
- `startTime`: ISO 8601 timestamp (e.g., `2024-01-01T00:00:00Z`)
- `endTime`: ISO 8601 timestamp

### Example: Finding all App Exports in the Last 7 Days
```bash
curl -X GET "https://tenant.us.qlikcloud.com/api/v1/audits?source=com.qlik.export&action=create&startTime=2024-01-01T00:00:00Z" \
  -H "Authorization: Bearer <API_KEY>"
```

## Common Sources & Actions

| Source | Action | Description |
|---|---|---|
| `com.qlik.login` | `create` | User successfully authenticated |
| `com.qlik.login` | `delete` | User logged out or session expired |
| `com.qlik.app` | `create` | New app created or duplicated |
| `com.qlik.app` | `delete` | App permanently deleted |
| `com.qlik.app.open` | `create` | User opened an app in the browser |
| `com.qlik.app.export` | `create` | User exported the full QVF file |
| `com.qlik.export` | `create` | User exported a chart to Excel/PDF |
| `com.qlik.space.member` | `create` | User/Group was added to a space |
| `com.qlik.space.member` | `delete` | User/Group was removed from a space |
| `com.qlik.reload` | `update` | App reload completed (status inside payload) |
| `com.qlik.api-key` | `create` | Developer generated a new API key |

## JSON Payload Structure

A typical audit event looks like this:

```json
{
  "data": [
    {
      "id": "e9b1...",
      "eventTime": "2024-05-15T14:32:00Z",
      "source": "com.qlik.app.export",
      "action": "create",
      "userId": "john.doe@company.com",
      "userName": "John Doe",
      "tenantId": "c4d2...",
      "resources": [
        {
          "id": "a1b2...",
          "type": "app",
          "name": "Finance Dashboard"
        }
      ],
      "extensions": {
        "ipAddress": "192.168.1.100",
        "userAgent": "Mozilla/5.0..."
      }
    }
  ]
}
```

### Parsing in Qlik Script
When loading this JSON in a Qlik script via the REST connector, you'll want to extract the `data` array and flatten the `resources` array to map the `userId` to the `App Name`.

```qlik
// Example REST connector load
AuditEvents:
LOAD
    "id" as EventID,
    "eventTime" as EventTime,
    "source" as EventSource,
    "action" as EventAction,
    "userId" as UserID
FROM JSON (wrap on) "data"
WITH CONNECTION (...);
```
