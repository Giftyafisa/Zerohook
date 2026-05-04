# QSR PostgreSQL Schema Reference

The Qlik Sense Repository Database (QSR) stores the metadata for the entire QSEoW environment.

## Primary Entities

| Table Name | Content | Primary Key (`ID`) |
|---|---|---|
| `"Apps"` | All Qlik Sense applications (.qvf files) | GUID |
| `"Users"` | All users synced from User Directory Connectors | GUID |
| `"Streams"` | Content streams | GUID |
| `"ReloadTasks"` | Reload task definitions | GUID |
| `"ExecutionResults"` | History of all task executions | GUID |
| `"SystemRules"` | Security rules and license rules | GUID |
| `"CustomPropertyDefinitions"` | Names of custom properties (e.g., 'Department') | GUID |
| `"CustomPropertyValues"` | Values for properties (e.g., 'Sales', 'HR') | GUID |
| `"DataConnections"` | Data connections (`lib://`) | GUID |

## Common Relationships (Joins)

The QSR uses standard foreign key relationships, typically suffixed with `_ID`.

### Apps to Owners and Streams
```sql
SELECT a."Name" as "AppName", u."UserId" as "Owner", s."Name" as "Stream"
FROM "Apps" a
LEFT JOIN "Users" u ON a."Owner_ID" = u."ID"
LEFT JOIN "Streams" s ON a."Stream_ID" = s."ID";
```

### Tasks to Apps
```sql
SELECT t."Name" as "TaskName", a."Name" as "AppName"
FROM "ReloadTasks" t
JOIN "Apps" a ON t."App_ID" = a."ID";
```

### Task Executions to Tasks
```sql
SELECT t."Name", e."Status", e."StartTime", e."Duration"
FROM "ExecutionResults" e
JOIN "ReloadTasks" t ON e."ReloadTask_ID" = t."ID";
```

## Many-to-Many Relationships (Mapping Tables)

Qlik uses mapping tables to assign Custom Properties and Tags to entities.

### App Custom Properties
To find which custom properties are assigned to an App, you must join through `AppCustomProperties` and `CustomPropertyValues`.

```sql
SELECT a."Name" as "AppName", cpd."Name" as "Property", cpv."Value"
FROM "Apps" a
JOIN "AppCustomProperties" acp ON a."ID" = acp."App_ID"
JOIN "CustomPropertyValues" cpv ON acp."CustomPropertyValue_ID" = cpv."ID"
JOIN "CustomPropertyDefinitions" cpd ON cpv."Definition_ID" = cpd."ID";
```

### User Custom Properties
```sql
SELECT u."UserId", cpd."Name" as "Property", cpv."Value"
FROM "Users" u
JOIN "UserCustomProperties" ucp ON u."ID" = ucp."User_ID"
JOIN "CustomPropertyValues" cpv ON ucp."CustomPropertyValue_ID" = cpv."ID"
JOIN "CustomPropertyDefinitions" cpd ON cpv."Definition_ID" = cpd."ID";
```

### Stream Custom Properties
```sql
SELECT s."Name" as "StreamName", cpd."Name" as "Property", cpv."Value"
FROM "Streams" s
JOIN "StreamCustomProperties" scp ON s."ID" = scp."Stream_ID"
JOIN "CustomPropertyValues" cpv ON scp."CustomPropertyValue_ID" = cpv."ID"
JOIN "CustomPropertyDefinitions" cpd ON cpv."Definition_ID" = cpd."ID";
```

## Schema Important Notes

1. **Case Sensitivity**: PostgreSQL is case-sensitive when identifiers are quoted. You **must** wrap table and column names in double quotes exactly as they appear in the schema (e.g., `"Apps"`, `"Name"`, `"Owner_ID"`).
2. **Soft Deletes**: Qlik rarely deletes records immediately. Instead, it marks them with `"Deleted" = true`. Always include `WHERE "Deleted" = false` in your queries unless you are specifically auditing deleted items.
3. **GUIDs**: All IDs are UUIDs (stored as the `uuid` data type in PostgreSQL).
4. **Dates/Times**: Stored in UTC. You may need to cast or convert them to local time in your Qlik script or SQL query.
