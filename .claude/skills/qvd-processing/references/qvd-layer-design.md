# QVD Layer Architecture Design

## Overview

A well-designed QVD layer separates concerns and makes your Qlik environment maintainable, performant, and resilient.

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌──────────┐
│   Sources    │ →  │  Extract    │ →  │  Transform  │ →  │   App    │
│ (DB/CSV/API) │    │  QVDs       │    │  QVDs       │    │  Load    │
└─────────────┘    └─────────────┘    └─────────────┘    └──────────┘
```

## Layer 1: Extract (Raw)

**Purpose:** Exact copy of source data with minimal transformation.

**Rules:**
- One QVD per source table
- No business logic
- No field renaming (keep original names)
- Add audit fields: `_ExtractTimestamp`, `_SourceSystem`
- Run on schedule (hourly, daily, etc.)

```qlik
///$tab Extract-Customers
LET vExtractTime = Now();

_RawCustomers:
LOAD
    *,
    '$(vExtractTime)' as _ExtractTimestamp,
    'CRM' as _SourceSystem
FROM [lib://CRM_Connection/customers.csv]
(txt, utf8, embedded labels, delimiter is ',');

STORE _RawCustomers INTO [lib://QVD_Extract/customers_raw.qvd] (qvd);
DROP TABLE _RawCustomers;
TRACE Extracted $(NoOfRows('_RawCustomers')) customers;
```

**Naming convention:** `<source>_<table>_raw.qvd`
- `crm_customers_raw.qvd`
- `erp_orders_raw.qvd`
- `web_events_raw.qvd`

## Layer 2: Transform (Business)

**Purpose:** Apply business logic, standardize field names, create calculated fields, join related data.

**Rules:**
- Read from Extract QVDs only (never from source)
- Apply mappings, lookups, calculations
- Standardize field names to PascalCase
- Handle nulls, data quality issues
- Create calendar, link tables

```qlik
///$tab Transform-Orders
// Read from extract QVD (optimized load)
_Raw:
LOAD * FROM [lib://QVD_Extract/erp_orders_raw.qvd] (qvd);

// Apply business logic
Orders:
LOAD
    order_id as OrderID,
    customer_id as CustomerID,
    Date#(order_date, 'YYYY-MM-DD') as OrderDate,
    ApplyMap('StatusMap', status_code, 'Unknown') as OrderStatus,
    quantity * unit_price as LineTotal,
    If(IsNull(ship_date), 0, 1) as IsShipped
RESIDENT _Raw;

DROP TABLE _Raw;

STORE Orders INTO [lib://QVD_Transform/orders.qvd] (qvd);
DROP TABLE Orders;
```

**Naming convention:** `<entity>.qvd`
- `orders.qvd`
- `customers.qvd`
- `products.qvd`
- `master_calendar.qvd`

## Layer 3: App Load

**Purpose:** Load transform QVDs into the app data model. This should be fast and simple.

**Rules:**
- Read from Transform QVDs only
- Use optimized loads (no WHERE, no rename, no calculations)
- If filtering is needed, load full QVD first, then filter via RESIDENT
- Build star schema associations here

```qlik
///$tab App-Load
// These are all OPTIMIZED loads (fastest possible)
Customers:
LOAD * FROM [lib://QVD_Transform/customers.qvd] (qvd);

Products:
LOAD * FROM [lib://QVD_Transform/products.qvd] (qvd);

Orders:
LOAD * FROM [lib://QVD_Transform/orders.qvd] (qvd);

MasterCalendar:
LOAD * FROM [lib://QVD_Transform/master_calendar.qvd] (qvd);

TRACE App load complete;
```

## Folder Structure

```
lib://QVD_Extract/
├── crm_customers_raw.qvd
├── erp_orders_raw.qvd
├── erp_products_raw.qvd
└── web_events_raw.qvd

lib://QVD_Transform/
├── customers.qvd
├── orders.qvd
├── products.qvd
├── master_calendar.qvd
└── link_order_product.qvd

lib://QVD_Archive/          (optional)
├── 2024/
│   ├── orders_2024.qvd
│   └── events_2024.qvd
```

## Multiple Apps Sharing QVDs

The transform layer enables multiple apps to share the same QVDs:

```
Transform QVDs
├── orders.qvd ──────→ Sales Dashboard App
│                ────→ Finance Reporting App
├── customers.qvd ──→ Sales Dashboard App
│                ────→ Customer 360 App
├── products.qvd ───→ Sales Dashboard App
│                ────→ Inventory App
```

**Benefits:**
- Business logic defined once
- Consistent data across all apps
- Apps reload fast (QVD reads only)
- Source system changes only affect extract layer

## Scheduling

| Layer | Schedule | Duration |
|---|---|---|
| Extract | Every 1-4 hours | Minutes (incremental) |
| Transform | After extract completes | Minutes |
| App reload | After transform completes (or on-demand) | Seconds-minutes |

Use Qlik task chaining or external schedulers to ensure proper execution order.

## Anti-Patterns to Avoid

1. **App loading directly from source** — Bypasses the QVD layer, makes apps slow and fragile
2. **Business logic in extract layer** — Makes extracts brittle and hard to debug
3. **Transform reading from source** — Defeats the purpose of the extract layer
4. **No naming convention** — QVDs become unmanageable at scale
5. **Storing QVDs in the same connection as source files** — Keep QVDs separate for clarity
6. **No TRACE statements** — You won't know when something breaks
