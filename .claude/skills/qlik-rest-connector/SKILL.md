---
name: qlik-rest-connector
description: >
  Load data from REST APIs into Qlik using the REST connector. Covers
  connection setup, pagination handling, JSON/XML parsing, authentication
  patterns (API key, OAuth, Basic), nested data flattening, and
  incremental API loads. Use when loading data from web APIs.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-data
---

# Qlik REST Connector

## When to Use

- User needs to load data from a REST API into Qlik
- User asks about JSON loading, API pagination, or web data
- User mentions REST connector, HTTP requests, or API authentication
- User needs to flatten nested JSON structures
- User wants to combine API data with other sources

## REST Connector Overview

Qlik's REST connector allows loading data from HTTP/HTTPS endpoints that return JSON or XML. It handles:
- GET/POST requests
- Authentication (API key, OAuth 2.0, Basic)
- Pagination (next page URL, offset, cursor)
- JSON/XML response parsing with path navigation

## Connection Setup

### Qlik Cloud
1. **Management Console → Data connections → Create**
2. Select **REST** connector
3. Configure:
   - **URL**: Base API endpoint
   - **Authentication**: Choose method
   - **Headers**: Custom headers (API keys, etc.)

### QSEoW (On-Premise)
1. **QMC → Data connections → Create new**
2. Select **REST** connector
3. Configure similarly

### Using in Script
```qlik
LIB CONNECT TO 'MyRestConnection';

RestConnectorMasterTable:
SQL SELECT
    "__KEY_root",
    (SELECT
        "id",
        "name",
        "email",
        "__FK_data"
    FROM "data" FK "__FK_data")
FROM JSON (wrap on) "root" PK "__KEY_root";
```

## Authentication Patterns

### API Key in Header
```qlik
// Configured in the connection itself, or:
// Use WITH CONNECTION in the REST call

RestConnectorMasterTable:
SQL SELECT
    *
FROM JSON (wrap on) "root"
WITH CONNECTION (
    URL "https://api.example.com/data",
    HTTPHEADER "Authorization" "Bearer YOUR_API_KEY",
    HTTPHEADER "Content-Type" "application/json"
);
```

### API Key in Query Parameter
```qlik
RestConnectorMasterTable:
SQL SELECT
    *
FROM JSON (wrap on) "root"
WITH CONNECTION (
    URL "https://api.example.com/data?api_key=$(vApiKey)"
);
```

### Basic Auth
```qlik
// Configure in the REST connection settings:
// Authentication Type: Basic
// Username: your_username
// Password: your_password
```

### OAuth 2.0
```qlik
// Configure in the REST connection settings:
// Authentication Type: OAuth 2.0
// Grant Type: Client Credentials (most common for APIs)
// Token URL: https://auth.example.com/oauth/token
// Client ID: your_client_id
// Client Secret: your_client_secret
```

## JSON Response Parsing

### Simple Flat Response
```json
{
  "data": [
    {"id": 1, "name": "Alice", "email": "alice@co.com"},
    {"id": 2, "name": "Bob", "email": "bob@co.com"}
  ]
}
```

```qlik
LIB CONNECT TO 'MyApi';

RestConnectorMasterTable:
SQL SELECT
    "__KEY_root",
    (SELECT
        "id",
        "name",
        "email",
        "__FK_data"
    FROM "data" FK "__FK_data")
FROM JSON (wrap on) "root" PK "__KEY_root";

// Flatten: extract the nested "data" array
ApiData:
LOAD
    [id],
    [name],
    [email]
RESIDENT RestConnectorMasterTable
WHERE NOT IsNull([__FK_data]);

DROP TABLE RestConnectorMasterTable;
```

### Nested Objects
```json
{
  "results": [
    {
      "id": 1,
      "address": {
        "city": "London",
        "country": "UK"
      }
    }
  ]
}
```

```qlik
RestConnectorMasterTable:
SQL SELECT
    "__KEY_root",
    (SELECT
        "id",
        "__KEY_results",
        "__FK_results",
        (SELECT
            "city",
            "country",
            "__FK_address"
        FROM "address" FK "__FK_address" PK "__KEY_address")
    FROM "results" FK "__FK_results" PK "__KEY_results")
FROM JSON (wrap on) "root" PK "__KEY_root";

// Join nested data
_Results:
LOAD [id], [__KEY_results]
RESIDENT RestConnectorMasterTable
WHERE NOT IsNull([__FK_results]);

_Addresses:
LOAD [city], [country], [__FK_address] as [__KEY_results]
RESIDENT RestConnectorMasterTable
WHERE NOT IsNull([__FK_address]);

ApiData:
NOCONCATENATE LOAD
    r.[id],
    a.[city],
    a.[country]
RESIDENT _Results as r
LEFT JOIN (_Addresses) as a
ON r.[__KEY_results] = a.[__KEY_results];

DROP TABLES RestConnectorMasterTable, _Results, _Addresses;
```

## Pagination Patterns

### Offset-Based Pagination
```qlik
LET vPageSize = 100;
LET vOffset = 0;
LET vHasMore = 1;

DO WHILE vHasMore = 1
    TRACE Loading page at offset $(vOffset)...;
    
    _Page:
    SQL SELECT
        "__KEY_root",
        "total_count",
        (SELECT "id", "name", "__FK_data"
         FROM "data" FK "__FK_data")
    FROM JSON (wrap on) "root" PK "__KEY_root"
    WITH CONNECTION (
        URL "https://api.example.com/items?limit=$(vPageSize)&offset=$(vOffset)"
    );
    
    _PageData:
    NOCONCATENATE LOAD [id], [name]
    RESIDENT _Page WHERE NOT IsNull([__FK_data]);
    
    LET vPageRows = NoOfRows('_PageData');
    
    IF vPageRows > 0 THEN
        CONCATENATE(AllApiData) LOAD * RESIDENT _PageData;
        LET vOffset = vOffset + vPageSize;
    ELSE
        LET vHasMore = 0;
    END IF
    
    DROP TABLES _Page, _PageData;
LOOP

TRACE Loaded $(NoOfRows('AllApiData')) total rows from API;
```

### Cursor/Next-URL Pagination
```qlik
LET vUrl = 'https://api.example.com/items?limit=100';
LET vHasMore = 1;
LET vPage = 0;

DO WHILE vHasMore = 1
    LET vPage = vPage + 1;
    TRACE Loading page $(vPage)...;
    
    _Page:
    SQL SELECT
        "__KEY_root",
        "next_url",
        (SELECT "id", "name", "__FK_data"
         FROM "data" FK "__FK_data")
    FROM JSON (wrap on) "root" PK "__KEY_root"
    WITH CONNECTION (URL "$(vUrl)");
    
    // Get next URL
    LET vNextUrl = Peek('next_url', 0, '_Page');
    
    _PageData:
    NOCONCATENATE LOAD [id], [name]
    RESIDENT _Page WHERE NOT IsNull([__FK_data]);
    
    LET vPageRows = NoOfRows('_PageData');
    
    IF vPageRows > 0 THEN
        CONCATENATE(AllApiData) LOAD * RESIDENT _PageData;
    END IF
    
    DROP TABLES _Page, _PageData;
    
    IF Len('$(vNextUrl)') > 0 AND '$(vNextUrl)' <> 'null' THEN
        LET vUrl = '$(vNextUrl)';
    ELSE
        LET vHasMore = 0;
    END IF
LOOP
```

## POST Requests

```qlik
// For APIs that require POST with a body
RestConnectorMasterTable:
SQL SELECT *
FROM JSON (wrap on) "root"
WITH CONNECTION (
    URL "https://api.example.com/query",
    HTTPHEADER "Content-Type" "application/json",
    HTTPHEADER "Authorization" "Bearer $(vApiKey)",
    BODY "{""query"": ""SELECT * FROM table WHERE date > '2024-01-01'""}",
    METHOD "POST"
);
```

## Common API Patterns

### Loading from Qlik Cloud REST API
```qlik
// List apps from Qlik Cloud
LIB CONNECT TO 'QlikCloudApi';

_Apps:
SQL SELECT
    "__KEY_root",
    (SELECT
        "id" as "appId",
        "name" as "appName",
        "description",
        "spaceId",
        "__FK_data"
    FROM "data" FK "__FK_data")
FROM JSON (wrap on) "root" PK "__KEY_root"
WITH CONNECTION (
    URL "https://$(vTenantUrl)/api/v1/items?resourceType=app&limit=100",
    HTTPHEADER "Authorization" "Bearer $(vApiKey)"
);

QlikApps:
LOAD [appId], [appName], [description], [spaceId]
RESIDENT _Apps WHERE NOT IsNull([__FK_data]);

DROP TABLE _Apps;
```

### Loading from a Weather API
```qlik
_Weather:
SQL SELECT
    "temperature",
    "humidity",
    "wind_speed",
    "description"
FROM JSON (wrap on) "current"
WITH CONNECTION (
    URL "https://api.weather.com/v1/current?location=$(vCity)&key=$(vWeatherApiKey)"
);
```

## Best Practices

1. **Store API keys in variables** — Never hardcode in the script
2. **Add TRACE for each API call** — Track progress and debug pagination
3. **Set ErrorMode = 0** around API calls — APIs can be unreliable
4. **Cache API results in QVDs** — Don't re-fetch unchanged data
5. **Respect rate limits** — Add `Sleep()` between calls if needed
6. **Use POST for complex queries** — GET has URL length limits
7. **Flatten nested JSON immediately** — Don't keep the MasterTable

## Troubleshooting

| Issue | Fix |
|---|---|
| Empty results | Check URL, auth, and response format |
| "Connection refused" | Verify endpoint is reachable from Qlik server |
| Auth errors (401/403) | Check API key, OAuth token expiry |
| Nested data missing | Check `__FK_` and `__KEY_` relationships |
| Pagination loop forever | Add max page limit (`vPage > 100`) |
| Timeout | Increase connection timeout, reduce page size |

[See references/json-parsing.md for complex JSON structures]
[See assets/ for ready-to-use REST loading templates]
