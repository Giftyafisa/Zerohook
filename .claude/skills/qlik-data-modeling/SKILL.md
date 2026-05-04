---
name: qlik-data-modeling
description: >
  Design star schema data models in Qlik with proper key handling, avoiding
  synthetic keys and circular references. Covers fact and dimension tables,
  link tables, master calendar generation, key naming conventions, QUALIFY/
  UNQUALIFY, and data model troubleshooting. Use when building or fixing
  a Qlik data model.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-core
---

# Qlik Data Modeling

## When to Use

- User is designing a data model for a Qlik app
- User has synthetic keys and needs to resolve them
- User needs a master calendar or link table
- User asks about star schema, snowflake, or associative model
- User mentions "circular reference", "synthetic key", or "data model"
- User needs to connect fact tables to dimension tables

## Qlik's Associative Model

Qlik uses an **associative engine**, not a relational database. Key principles:

1. **Tables associate automatically** through identically named fields
2. **One shared field per table pair** — more than one creates synthetic keys
3. **No explicit foreign keys** — association is by field name match
4. **Star schema is ideal** — one central fact table, surrounded by dimension tables
5. **All selections affect all tables** — there's no "direction" to joins

## Star Schema Design

```
                    ┌──────────────┐
                    │  DimCustomer │
                    │  %CustomerKey│
                    └──────┬───────┘
                           │
┌──────────────┐    ┌──────┴───────┐    ┌──────────────┐
│  DimProduct  │────│  FactSales   │────│   DimDate    │
│  %ProductKey │    │  %CustomerKey│    │  %DateKey    │
└──────────────┘    │  %ProductKey │    └──────────────┘
                    │  %DateKey    │
                    │  Amount      │
                    │  Quantity    │
                    └──────────────┘
```

**Rules:**
- Fact tables contain measures (Amount, Quantity) and foreign keys
- Dimension tables contain descriptive attributes (Name, Category, Region)
- Each dimension connects to the fact via exactly **one** key field
- Key fields use `%` prefix convention: `%CustomerKey`, `%ProductKey`

## Key Naming Convention

Use the `%` prefix for all key/link fields. This:
- Makes keys visually distinct from measure/attribute fields
- Helps Qlik developers immediately identify association fields
- Can be hidden from end users using `TAG FIELD %Key WITH '$hidden'`

```qlik
// Create consistent keys
LOAD
    CustomerID as %CustomerKey,
    CustomerName,
    Region,
    Segment
FROM [lib://Data/customers.qvd] (qvd);

LOAD
    OrderID,
    CustomerID as %CustomerKey,
    ProductID as %ProductKey,
    Date#(OrderDate, 'YYYY-MM-DD') as %DateKey,
    Amount,
    Quantity
FROM [lib://Data/orders.qvd] (qvd);
```

## Synthetic Keys — Detection & Resolution

### What Are Synthetic Keys?

When two tables share **more than one** identically named field, Qlik creates a synthetic key — a concatenated compound key. This is almost always unintentional and causes:
- Performance degradation
- Unexpected filtering behavior
- Confusing data model

### Example Problem
```qlik
// Both tables have CustomerID AND Region
Customers: LOAD CustomerID, Region, Name FROM ...;
Orders: LOAD CustomerID, Region, Amount FROM ...;
// → Qlik creates $Syn 1 = CustomerID & '|' & Region
```

### Resolution Strategies

**Strategy 1: Rename the duplicate field**
```qlik
Customers: LOAD CustomerID as %CustomerKey, Region as CustomerRegion, Name FROM ...;
Orders: LOAD CustomerID as %CustomerKey, Region as OrderRegion, Amount FROM ...;
// Now only %CustomerKey is shared — no synthetic key
```

**Strategy 2: Drop the duplicate from one table**
```qlik
Customers: LOAD CustomerID as %CustomerKey, Region, Name FROM ...;
Orders: LOAD CustomerID as %CustomerKey, Amount FROM ...;
// Region only comes from Customers — no synthetic key
```

**Strategy 3: Create a composite key explicitly**
```qlik
// If you truly need both fields as a compound key:
Customers: LOAD *, CustomerID & '|' & Region as %CustRegionKey FROM ...;
Orders: LOAD *, CustomerID & '|' & Region as %CustRegionKey FROM ...;
// Then drop the individual shared fields from one table
```

**Strategy 4: Use QUALIFY/UNQUALIFY**
```qlik
QUALIFY *;           // Prefix ALL fields with table name
UNQUALIFY %*;        // Except key fields (% prefix)

Customers: LOAD CustomerID as %CustomerKey, Region, Name FROM ...;
Orders: LOAD CustomerID as %CustomerKey, Region, Amount FROM ...;
// Result: Customers.Region, Orders.Region — no conflict
// %CustomerKey is NOT qualified — it still links the tables

UNQUALIFY *;         // Reset for subsequent loads
```

## Circular References

### What Are Circular References?

When three or more tables form a loop of associations:

```
TableA ←→ TableB ←→ TableC ←→ TableA   // Loop!
```

Qlik cannot resolve circular references and will generate an error or create a loosely coupled table.

### Resolution: Break the Loop

**Option A: Remove one association**
Only load the key field in one of the tables that breaks the loop.

**Option B: Use a link table**
Create a composite key table that sits between the conflicting tables:

```qlik
// Instead of: Orders ↔ Products ↔ Suppliers ↔ Orders

LinkTable:
LOAD DISTINCT
    OrderID & '|' & ProductID & '|' & SupplierID as %LinkKey,
    OrderID as %OrderKey,
    ProductID as %ProductKey,
    SupplierID as %SupplierKey
RESIDENT _RawData;

// Each dimension now connects only through LinkTable
```

## Link Tables

Use a link table when multiple fact tables share the same dimensions but would otherwise create synthetic keys or circular references.

```qlik
// Two fact tables: Sales and Budget
// Both have ProductID, DateKey, RegionKey
// Loading both directly → synthetic keys

// Solution: Link table
LinkTable:
LOAD DISTINCT
    ProductID & '|' & DateKey & '|' & RegionKey as %LinkKey,
    ProductID as %ProductKey,
    DateKey as %DateKey,
    RegionKey as %RegionKey
RESIDENT _AllFacts;

// Fact tables connect through %LinkKey only
FactSales:
LOAD
    ProductID & '|' & DateKey & '|' & RegionKey as %LinkKey,
    SalesAmount,
    Quantity
RESIDENT _Sales;

FactBudget:
LOAD
    ProductID & '|' & DateKey & '|' & RegionKey as %LinkKey,
    BudgetAmount
RESIDENT _Budget;
```

## Master Calendar

Every Qlik app with dates needs a master calendar to ensure continuous date axes in charts.

```qlik
// Step 1: Find date range from your fact table
_DateRange:
LOAD
    Min(%DateKey) as MinDate,
    Max(%DateKey) as MaxDate
RESIDENT FactSales;

LET vMinDate = Peek('MinDate', 0, '_DateRange');
LET vMaxDate = Peek('MaxDate', 0, '_DateRange');
DROP TABLE _DateRange;

// Step 2: Generate calendar
MasterCalendar:
LOAD
    TempDate as %DateKey,
    Year(TempDate) as Year,
    Month(TempDate) as Month,
    Day(TempDate) as Day,
    Date(MonthStart(TempDate), 'YYYY-MM') as YearMonth,
    'Q' & Ceil(Month(TempDate) / 3) as Quarter,
    Year(TempDate) & '-Q' & Ceil(Month(TempDate) / 3) as YearQuarter,
    Week(TempDate) as Week,
    WeekDay(TempDate) as WeekDayNum,
    If(WeekDay(TempDate) >= 5, 'Weekend', 'Weekday') as DayType,
    If(Month(TempDate) <= 6, 'H1', 'H2') as HalfYear
;
LOAD
    Date($(vMinDate) + IterNo() - 1) as TempDate
AUTOGENERATE 1
WHILE $(vMinDate) + IterNo() - 1 <= $(vMaxDate);

TRACE Calendar: $(NoOfRows('MasterCalendar')) days ($(vMinDate) to $(vMaxDate));
```

## Data Model Checklist

- [ ] Star schema: one fact table at center, dimensions around it
- [ ] Each table pair shares exactly ONE key field
- [ ] No synthetic keys (check Data Model Viewer)
- [ ] No circular references
- [ ] Key fields use `%` prefix
- [ ] Master calendar generated and linked via `%DateKey`
- [ ] Temporary tables dropped
- [ ] Field names are consistent (PascalCase, no spaces)
- [ ] Hidden key fields with `$hidden` tag if needed

## Tips

1. **Check the Data Model Viewer** after every reload — it shows synthetic keys, associations, and table sizes
2. **Use QUALIFY/UNQUALIFY** when loading many tables from a database with overlapping column names
3. **Avoid snowflake schemas** in Qlik — flatten dimension hierarchies (e.g., Product → Category → Department becomes one DimProduct table)
4. **Use `Autonumber(%Key)`** to convert string keys to integers for better performance on large models
5. **Test with `NoOfRows()`** — compare expected vs actual row counts after joins

[See references/star-schema.md for detailed star schema patterns]
[See references/synthetic-keys.md for advanced synthetic key resolution]
[See references/calendar-generation.md for fiscal and custom calendar patterns]
[See references/link-tables.md for multi-fact table scenarios]
[See assets/ for ready-to-use templates]
