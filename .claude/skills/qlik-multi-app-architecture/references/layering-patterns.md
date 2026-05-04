# Advanced Multi-App Layering Patterns

## Pattern 1: Domain-Based Layering

Separate Extract/Transform by business domain when source systems are independent:

```
                    ┌── ETL_Extract_CRM ──→ QVD_Raw_CRM/
Data Sources  ──→   ├── ETL_Extract_ERP ──→ QVD_Raw_ERP/
                    └── ETL_Extract_Web ──→ QVD_Raw_Web/
                              ↓
                    ┌── ETL_Transform_Sales ──→ QVD_Sales/
Transform     ──→   ├── ETL_Transform_Finance ──→ QVD_Finance/
                    └── ETL_Transform_Marketing ──→ QVD_Marketing/
                              ↓
Present       ──→   APP_Sales_Dashboard, APP_Finance_Report, etc.
```

**When to use:** Large organizations with many source systems and clear domain boundaries.

## Pattern 2: Aggregation Layer

Add a 4th layer between Transform and Present for pre-aggregated data:

```
Extract → Transform → Aggregate → Present

Aggregate Layer:
  - Monthly summaries (fact_orders → agg_monthly_orders)
  - Daily rollups
  - Pre-calculated KPIs
```

```qlik
// Aggregate app
_MonthlyOrders:
LOAD
    %CustomerKey,
    %ProductKey,
    Date(MonthStart(%DateKey)) as %MonthKey,
    Sum(Amount) as MonthlyAmount,
    Sum(Quantity) as MonthlyQuantity,
    Count(DISTINCT OrderID) as MonthlyOrderCount
FROM [lib://QVD_Transform/fact_orders.qvd] (qvd)
GROUP BY %CustomerKey, %ProductKey, Date(MonthStart(%DateKey));

STORE _MonthlyOrders INTO [lib://QVD_Aggregate/agg_monthly_orders.qvd] (qvd);
```

**When to use:** Executive dashboards that don't need transaction-level detail.

## Pattern 3: Shared Dimension Bus

All apps share the same dimension QVDs but have different fact tables:

```
Shared Dimensions (lib://QVD_Shared/):
  dim_customers.qvd     ← Used by all apps
  dim_products.qvd      ← Used by all apps
  master_calendar.qvd   ← Used by all apps

Domain Facts:
  lib://QVD_Sales/fact_orders.qvd       ← Sales app only
  lib://QVD_Finance/fact_invoices.qvd   ← Finance app only
  lib://QVD_HR/fact_employees.qvd       ← HR app only
```

**Key rule:** Dimension key fields must use identical names across ALL QVDs (`%CustomerKey`, `%DateKey`, etc.).

## Pattern 4: Incremental QVD Chain

Each layer only processes changed data:

```
Extract:   Load only new/modified records → Merge into Raw QVDs
Transform: Detect changed Raw QVDs → Rebuild only affected Transform QVDs
Present:   Always load full Transform QVDs (they're already filtered)
```

```qlik
// Extract: Incremental merge
_Existing: LOAD * FROM [lib://QVD_Raw/orders_raw.qvd] (qvd);
LET vMaxDate = Peek('ModifiedDate', NoOfRows('_Existing') - 1, '_Existing');

_New: SQL SELECT * FROM orders WHERE ModifiedDate > '$(vMaxDate)';

CONCATENATE(_Existing) LOAD * RESIDENT _New;
DROP TABLE _New;
STORE _Existing INTO [lib://QVD_Raw/orders_raw.qvd] (qvd);
DROP TABLE _Existing;
```

## Pattern 5: Multi-Tenant Architecture

Same app structure for multiple clients/tenants:

```
For each tenant:
  lib://QVD_Raw/{TenantID}/
  lib://QVD_Transform/{TenantID}/
  APP_{TenantID}_Dashboard
```

```qlik
// Parameterized script
SET vTenantID = 'ACME';
SET vRawPath = 'lib://QVD_Raw/$(vTenantID)';
SET vTransPath = 'lib://QVD_Transform/$(vTenantID)';

// Same script works for all tenants — just change vTenantID
LOAD * FROM [$(vTransPath)/dim_customers.qvd] (qvd);
```

## QVD Naming Conventions

```
Raw QVDs:        {source_table}_raw.qvd
                 customers_raw.qvd, orders_raw.qvd

Transform QVDs:  dim_{entity}.qvd, fact_{entity}.qvd
                 dim_customers.qvd, fact_orders.qvd

Aggregate QVDs:  agg_{granularity}_{entity}.qvd
                 agg_monthly_orders.qvd, agg_daily_sales.qvd

Config QVDs:     _config.qvd, _metadata.qvd (prefix with underscore)

Calendar:        master_calendar.qvd
```

## Dependency Tracking

Create a metadata QVD that tracks what was last updated:

```qlik
// At the end of each ETL app
_ETL_Log:
LOAD * INLINE [
    AppName, Layer, Status, Timestamp, RowCount
    ETL_Extract_Sales, Extract, Success, $(=Timestamp(Now())), $(vTotalRows)
];

// Append to shared log
SET ErrorMode = 0;
_ExistingLog: LOAD * FROM [lib://QVD_Meta/etl_log.qvd] (qvd);
SET ErrorMode = 1;

IF NOT IsNull(TableNumber('_ExistingLog')) THEN
    CONCATENATE(_ExistingLog) LOAD * RESIDENT _ETL_Log;
    STORE _ExistingLog INTO [lib://QVD_Meta/etl_log.qvd] (qvd);
    DROP TABLES _ExistingLog, _ETL_Log;
ELSE
    STORE _ETL_Log INTO [lib://QVD_Meta/etl_log.qvd] (qvd);
    DROP TABLE _ETL_Log;
END IF
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Spaghetti QVDs** | Apps read from random QVD folders | Strict layer separation |
| **Transform in Present** | Business logic in every app | Centralize in Transform layer |
| **Circular dependencies** | App A generates QVDs for App B, which generates for App A | DAG structure only |
| **Giant monolith app** | 50M rows, 200 fields, slow reload | Split into layers |
| **No naming convention** | `data.qvd`, `temp.qvd`, `final2.qvd` | Standard naming (see above) |
| **Shared connections in Present** | Present apps connecting directly to databases | Only Extract connects to sources |
