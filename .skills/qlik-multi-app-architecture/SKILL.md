---
name: qlik-multi-app-architecture
description: >
  Design and implement multi-app Qlik architectures using QVD layering
  (Extract, Transform, Present), Binary loads, shared QVD buses, and
  app segmentation strategies. Covers the ETL pipeline pattern,
  app sizing guidelines, shared data layers, and governance across
  multiple interconnected apps. Use when designing enterprise Qlik
  environments with multiple apps sharing data.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-architecture
---

# Qlik Multi-App Architecture

## When to Use

- User is designing an enterprise Qlik environment with multiple apps
- User asks about QVD layers, data bus, or shared data architecture
- User mentions Binary load or splitting a large app
- User needs extract/transform/present app separation
- User asks how to share data between multiple Qlik apps
- User has an app exceeding memory limits and needs to split it

## The QVD Layer Architecture

The standard enterprise pattern splits Qlik processing into **three layers**:

```
┌─────────────────────────────────────────────────────┐
│                    DATA SOURCES                      │
│  SQL Server  │  REST APIs  │  Excel  │  SAP  │ ...  │
└──────────────┬──────────────────────────────────────┘
               ↓
┌──────────────────────────────────────────────────────┐
│              EXTRACT LAYER (QVD Generator)            │
│  App: ETL_Extract                                    │
│  • Connects to all source systems                    │
│  • Loads raw data with minimal transformation        │
│  • STOREs as Raw QVDs (1:1 with source tables)       │
│  • Scheduled: Every 2-4 hours                        │
│  └── lib://QVD_Raw/customers_raw.qvd                 │
│  └── lib://QVD_Raw/orders_raw.qvd                    │
│  └── lib://QVD_Raw/products_raw.qvd                  │
└──────────────┬───────────────────────────────────────┘
               ↓
┌──────────────────────────────────────────────────────┐
│             TRANSFORM LAYER (QVD Transformer)        │
│  App: ETL_Transform                                  │
│  • Loads from Raw QVDs (optimized reads — fast)      │
│  • Applies business logic, joins, calculations       │
│  • Builds star schema dimensions and facts           │
│  • STOREs as Transformed QVDs                        │
│  • Scheduled: After Extract completes                │
│  └── lib://QVD_Transform/dim_customers.qvd           │
│  └── lib://QVD_Transform/dim_products.qvd            │
│  └── lib://QVD_Transform/fact_orders.qvd             │
│  └── lib://QVD_Transform/master_calendar.qvd         │
└──────────────┬───────────────────────────────────────┘
               ↓
┌──────────────────────────────────────────────────────┐
│             PRESENT LAYER (User-Facing Apps)         │
│                                                      │
│  App: Sales Dashboard                                │
│  • Loads from Transformed QVDs (fast, clean)         │
│  • Contains UI, master items, expressions            │
│  • Scheduled: After Transform completes              │
│                                                      │
│  App: Finance Dashboard                              │
│  • Loads same Transformed QVDs + finance-specific    │
│                                                      │
│  App: Executive Summary                              │
│  • Loads aggregated QVDs only (small footprint)      │
└──────────────────────────────────────────────────────┘
```

## Why Use Layers?

| Benefit | Explanation |
|---|---|
| **Source isolation** | Only Extract apps connect to databases; if a source is slow, only Extract is affected |
| **Reusability** | Transform QVDs are shared across many presentation apps |
| **Performance** | Each layer loads from QVDs (fast) instead of source (slow) |
| **Governance** | Business logic is centralized in Transform, not scattered across apps |
| **Scalability** | Add new presentation apps without touching source systems |
| **Debugging** | Isolate issues to a specific layer |
| **Memory management** | Each app only loads what it needs |

## Extract Layer

### Purpose
Pull raw data from source systems and store as QVDs with minimal transformation.

### Script Pattern
```qlik
///$tab Config
SET vQvdRawPath = 'lib://QVD_Raw';
LET vExtractTimestamp = Now();
TRACE Extract started: $(vExtractTimestamp);

///$tab Customers
TRACE Extracting Customers...;
LIB CONNECT TO 'SQL_CRM';

_Customers:
SQL SELECT
    CustomerID,
    CustomerName,
    Email,
    Phone,
    Region,
    Segment,
    CreatedDate,
    ModifiedDate
FROM dbo.Customers
WHERE ModifiedDate >= '$(vLastExtractDate)';  // Incremental

STORE _Customers INTO [$(vQvdRawPath)/customers_raw.qvd] (qvd);
LET vCustRows = NoOfRows('_Customers');
TRACE Customers: $(vCustRows) rows extracted;
DROP TABLE _Customers;

///$tab Orders
TRACE Extracting Orders...;

_Orders:
SQL SELECT
    OrderID,
    CustomerID,
    ProductID,
    OrderDate,
    ShipDate,
    Amount,
    Quantity,
    Discount
FROM dbo.Orders
WHERE OrderDate >= '$(vLastExtractDate)';

STORE _Orders INTO [$(vQvdRawPath)/orders_raw.qvd] (qvd);
LET vOrdRows = NoOfRows('_Orders');
TRACE Orders: $(vOrdRows) rows extracted;
DROP TABLE _Orders;

///$tab Summary
TRACE ========================================;
TRACE EXTRACT COMPLETE;
TRACE   Customers: $(vCustRows) rows;
TRACE   Orders: $(vOrdRows) rows;
TRACE ========================================;
```

### Extract Best Practices
- **1:1 mapping** — One QVD per source table (don't join in Extract)
- **Minimal transformation** — Only data type casting if necessary
- **Incremental** — Use timestamps/IDs to load only changed records
- **Schedule first** — Extract runs before everything else
- **Log row counts** — Track data volumes for monitoring

## Transform Layer

### Purpose
Apply business logic, build star schema, create reusable dimensions and facts.

### Script Pattern
```qlik
///$tab Config
SET vQvdRawPath = 'lib://QVD_Raw';
SET vQvdTransPath = 'lib://QVD_Transform';

///$tab Dim-Customers
TRACE Building Dim_Customers...;

Dim_Customers:
LOAD
    CustomerID as %CustomerKey,
    Upper(Trim(CustomerName)) as CustomerName,
    If(Len(Trim(Email)) > 0, Lower(Trim(Email)), 'N/A') as Email,
    If(IsNull(Region), 'Unknown', Region) as Region,
    If(IsNull(Segment), 'Unclassified', Segment) as Segment,
    Date(CreatedDate) as CustomerSinceDate
FROM [$(vQvdRawPath)/customers_raw.qvd] (qvd);

STORE Dim_Customers INTO [$(vQvdTransPath)/dim_customers.qvd] (qvd);
TRACE Dim_Customers: $(NoOfRows('Dim_Customers')) rows;
DROP TABLE Dim_Customers;

///$tab Dim-Products
TRACE Building Dim_Products...;

Dim_Products:
LOAD
    ProductID as %ProductKey,
    ProductName,
    Category,
    SubCategory,
    UnitPrice
FROM [$(vQvdRawPath)/products_raw.qvd] (qvd);

STORE Dim_Products INTO [$(vQvdTransPath)/dim_products.qvd] (qvd);
DROP TABLE Dim_Products;

///$tab Fact-Orders
TRACE Building Fact_Orders...;

// Mapping tables for enrichment
_CustomerRegionMap:
MAPPING LOAD %CustomerKey, Region
FROM [$(vQvdTransPath)/dim_customers.qvd] (qvd);

Fact_Orders:
LOAD
    OrderID,
    CustomerID as %CustomerKey,
    ProductID as %ProductKey,
    Date(Floor(OrderDate)) as %DateKey,
    Amount,
    Quantity,
    Discount,
    Amount * (1 - Discount) as NetAmount,
    ApplyMap('_CustomerRegionMap', CustomerID, 'Unknown') as _OrderRegion
FROM [$(vQvdRawPath)/orders_raw.qvd] (qvd);

STORE Fact_Orders INTO [$(vQvdTransPath)/fact_orders.qvd] (qvd);
TRACE Fact_Orders: $(NoOfRows('Fact_Orders')) rows;
DROP TABLE Fact_Orders;

///$tab Master-Calendar
TRACE Building Master Calendar...;

// Generate date range from fact data
_DateRange:
LOAD Min(%DateKey) as MinDate, Max(%DateKey) as MaxDate
FROM [$(vQvdTransPath)/fact_orders.qvd] (qvd);

LET vMinDate = Peek('MinDate', 0, '_DateRange');
LET vMaxDate = Peek('MaxDate', 0, '_DateRange');
DROP TABLE _DateRange;

Master_Calendar:
LOAD
    Date($(vMinDate) + IterNo() - 1) as %DateKey,
    Year(Date($(vMinDate) + IterNo() - 1)) as Year,
    Month(Date($(vMinDate) + IterNo() - 1)) as Month,
    Num(Month(Date($(vMinDate) + IterNo() - 1))) as MonthNum,
    Date(MonthStart(Date($(vMinDate) + IterNo() - 1)), 'YYYY-MM') as YearMonth,
    'Q' & Ceil(Month(Date($(vMinDate) + IterNo() - 1)) / 3) as Quarter,
    WeekDay(Date($(vMinDate) + IterNo() - 1)) as WeekDay,
    If(Year(Date($(vMinDate) + IterNo() - 1)) = Year(Today())
        AND Month(Date($(vMinDate) + IterNo() - 1)) <= Month(Today()), 1, 0) as IsYTD,
    If(Date($(vMinDate) + IterNo() - 1) >= AddMonths(Today(), -12), 1, 0) as IsLast12Months
AUTOGENERATE $(vMaxDate) - $(vMinDate) + 1;

STORE Master_Calendar INTO [$(vQvdTransPath)/master_calendar.qvd] (qvd);
DROP TABLE Master_Calendar;
```

### Transform Best Practices
- **Star schema** — Distinct dimension tables linked to fact tables via keys
- **Clean data** — Null handling, trimming, standardization
- **Consistent keys** — Prefix with `%` (e.g., `%CustomerKey`)
- **Master calendar** — Pre-calculated flags (IsYTD, IsLast12Months)
- **ApplyMap over JOIN** — For adding single lookup fields

## Presentation Layer

### Purpose
Load transformed QVDs, build UI, provide analytics to users.

### Script Pattern
```qlik
///$tab Config
SET vQvdPath = 'lib://QVD_Transform';

///$tab Data-Model
// All loads are optimized QVD reads — extremely fast

Dim_Customers:
LOAD %CustomerKey, CustomerName, Region, Segment
FROM [$(vQvdPath)/dim_customers.qvd] (qvd);

Dim_Products:
LOAD %ProductKey, ProductName, Category, SubCategory
FROM [$(vQvdPath)/dim_products.qvd] (qvd);

Fact_Orders:
LOAD OrderID, %CustomerKey, %ProductKey, %DateKey, Amount, Quantity, NetAmount
FROM [$(vQvdPath)/fact_orders.qvd] (qvd);

Master_Calendar:
LOAD *
FROM [$(vQvdPath)/master_calendar.qvd] (qvd);
```

### Presentation Best Practices
- **Load only needed fields** — Don't `LOAD *` unless everything is used
- **Fast reloads** — All from QVDs, should complete in seconds
- **Focused scope** — Each app serves a specific audience/purpose
- **Master items** — Define governed measures and dimensions
- **No business logic here** — All transformations in the Transform layer

## Binary Load

Load an entire data model from another app instantly:

```qlik
// Must be the FIRST statement in the script
BINARY [lib://Apps/SharedDataModel.qvf];

// Then add app-specific logic
// (additional loads, calculations, section access, etc.)
```

### Binary Load Limitations
- Must be the **first statement** in the script
- Only **one** Binary statement per script
- No field selection — loads **everything**
- Creates a tight dependency on the source app

### When to Use Binary
- Prototype apps that need the same data model
- Quick clones for testing
- Small apps that share everything
- **NOT recommended** for production — use QVD layers instead

## App Sizing Guidelines

| App Size | Rows | Memory | Recommendation |
|---|---|---|---|
| **Small** | < 1M | < 500 MB | Single app is fine |
| **Medium** | 1-10M | 500 MB - 2 GB | Consider QVD layers |
| **Large** | 10-50M | 2-8 GB | Must use QVD layers |
| **Very Large** | 50M+ | 8 GB+ | Split into multiple presentation apps |

### Splitting Strategies

**By Department:**
```
Sales Dashboard    → loads dim_customers, fact_orders, calendar
Finance Dashboard  → loads dim_customers, fact_orders, fact_invoices, calendar
Operations Dashboard → loads fact_orders, fact_shipments, calendar
```

**By Time:**
```
Current Year App  → loads only current year data (fast, small)
Historical App    → loads 5+ years of data (larger, less frequent)
```

**By Granularity:**
```
Executive App     → loads pre-aggregated monthly summaries
Operational App   → loads transaction-level detail
```

## Task Scheduling Chain

```
06:00  ETL_Extract         ← Pulls from source systems
        ↓ on success
06:30  ETL_Transform        ← Builds star schema QVDs
        ↓ on success
07:00  Sales Dashboard      ← Reloads from QVDs (fast)
       Finance Dashboard    ← Reloads in parallel
       Executive Summary    ← Reloads in parallel
```

## Shared Variables & Configuration

### Central Config QVD
```qlik
// Create a config QVD that all apps read
_Config:
LOAD * INLINE [
    ConfigKey, ConfigValue
    vEnvironment, PROD
    vCurrency, USD
    vFiscalYearStart, 4
    vVersionDate, 2024-01-15
];

STORE _Config INTO [lib://QVD_Transform/_config.qvd] (qvd);
DROP TABLE _Config;
```

### Reading Config in Presentation Apps
```qlik
_Config:
LOAD * FROM [lib://QVD_Transform/_config.qvd] (qvd);

LET vEnvironment = Peek('ConfigValue', 0, '_Config');
// ... read other config values

DROP TABLE _Config;
```

## Governance Across Apps

### Naming Conventions
```
ETL_Extract_Sales       ← Extract app for sales source
ETL_Transform_Sales     ← Transform app for sales domain
APP_Sales_Dashboard     ← User-facing sales app
APP_Finance_Monthly     ← User-facing finance app
QVD_Raw/                ← Raw QVD folder
QVD_Transform/          ← Transformed QVD folder
```

### Documentation
- Document the **data flow** (which app produces which QVDs)
- Document **key field names** (%CustomerKey, %DateKey, etc.)
- Document **schedule dependencies** (what runs after what)
- Keep a **data dictionary** of all transformed fields

[See references/layering-patterns.md for advanced multi-app patterns]
[See assets/ for ETL script templates]
