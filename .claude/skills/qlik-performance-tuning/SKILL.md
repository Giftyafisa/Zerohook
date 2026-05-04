---
name: qlik-performance-tuning
description: >
  Optimize Qlik app performance for reload speed, memory usage, and
  responsiveness. Covers QVD optimization, field reduction, data type
  efficiency, expression optimization, aggregation strategies, and
  troubleshooting slow reloads and sluggish dashboards. Use when an
  app is slow to reload or charts are unresponsive.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-core
---

# Qlik Performance Tuning

## When to Use

- User reports slow reload times
- User says charts are laggy or unresponsive
- User asks about memory optimization or app size reduction
- User has large datasets (>10M rows) and needs scaling advice
- User mentions performance, optimization, or "too slow"

## Performance Hierarchy

Fix issues in this order (biggest impact first):

```
1. Data Model Design     — Star schema, no synthetic keys
2. Field Selection       — Load only needed fields
3. QVD Optimization      — Optimized loads, incremental patterns
4. Data Types            — Autonumber keys, proper types
5. Expression Efficiency — Set analysis > If(), use flags
6. Frontend Design       — Fewer objects, limit dimensions
```

## Reload Performance

### Load Only Needed Fields

```qlik
// ❌ BAD: Loading everything
LOAD * FROM [lib://QVD/orders.qvd] (qvd);

// ✅ GOOD: Load only what you need
LOAD
    OrderID,
    CustomerID,
    OrderDate,
    Amount,
    Quantity
FROM [lib://QVD/orders.qvd] (qvd);
```

**Impact:** Dropping unused fields can reduce memory by 30-50% and speed up reloads significantly.

### Optimized QVD Loads

An **optimized QVD load** reads the QVD in its native binary format — 10-100x faster than a standard load.

**Optimized** (fast):
```qlik
// No WHERE, no transformations, no preceding LOAD
LOAD * FROM [lib://QVD/data.qvd] (qvd);

// Field selection is still optimized
LOAD OrderID, Amount FROM [lib://QVD/data.qvd] (qvd);
```

**Not optimized** (slow):
```qlik
// WHERE clause breaks optimization
LOAD * FROM [lib://QVD/data.qvd] (qvd) WHERE Year > 2020;

// Transformation breaks optimization
LOAD *, Upper(Region) as REGION FROM [lib://QVD/data.qvd] (qvd);

// Preceding LOAD breaks optimization
LOAD *, Year(OrderDate) as Year;
LOAD * FROM [lib://QVD/data.qvd] (qvd);
```

**Workaround: Load then filter**
```qlik
// Load optimized, then filter in a second step
_Raw:
LOAD * FROM [lib://QVD/data.qvd] (qvd);

Filtered:
NOCONCATENATE LOAD * RESIDENT _Raw WHERE Year > 2020;
DROP TABLE _Raw;
```

### Autonumber for Large String Keys

String keys consume much more memory than integers:

```qlik
// Convert string keys to integers after all tables are loaded
// Saves memory on large models (>10M rows)

// Apply to all key fields:
Autonumber(%CustomerKey) as %CustomerKey;
Autonumber(%ProductKey) as %ProductKey;
Autonumber(%DateKey) as %DateKey;
```

**Caution:** Autonumber values change every reload. Never store them in QVDs meant for incremental loads.

### Parallel Loading (Qlik Cloud)

Qlik Cloud can load from multiple sources in parallel if they're independent:

```qlik
// These load independently and can be parallelized by the engine:
Customers: LOAD * FROM [lib://QVD/customers.qvd] (qvd);
Products: LOAD * FROM [lib://QVD/products.qvd] (qvd);
Orders: LOAD * FROM [lib://QVD/orders.qvd] (qvd);
```

### STORE Intermediate Results

For complex ETL, store intermediate QVDs to avoid reprocessing:

```qlik
// Step 1: Extract (only when source changes)
IF FileTime('lib://QVD/raw.qvd') < FileTime('lib://Source/data.csv') THEN
    _Raw: LOAD * FROM [lib://Source/data.csv] (txt, utf8, embedded labels, delimiter is ',');
    STORE _Raw INTO [lib://QVD/raw.qvd] (qvd);
    DROP TABLE _Raw;
END IF

// Step 2: Transform (always from QVD — fast)
LOAD * FROM [lib://QVD/raw.qvd] (qvd);
```

## Memory Optimization

### Reduce Cardinality

High-cardinality fields (many unique values) consume the most memory:

```qlik
// ❌ Loading a unique transaction ID with 50M values
LOAD TransactionGUID, Amount FROM ...;

// ✅ Use Autonumber or skip if not needed for analysis
LOAD Autonumber(TransactionGUID) as TransactionID, Amount FROM ...;

// ✅ Or don't load it at all if it's not used in charts
LOAD Amount, CustomerID, OrderDate FROM ...;
```

### Remove Redundant Fields

```qlik
// ❌ Both FirstName and FullName loaded
LOAD FirstName, LastName, FirstName & ' ' & LastName as FullName FROM ...;

// ✅ Only load what users actually need
LOAD FirstName & ' ' & LastName as CustomerName FROM ...;
```

### Use Flags Instead of Text

```qlik
// ❌ Text status field: 'Active', 'Inactive', 'Pending' (high memory)
LOAD Status FROM ...;

// ✅ Numeric flag (low memory) + mapping for display
LOAD
    If(Status = 'Active', 1, If(Status = 'Pending', 2, 0)) as StatusFlag
FROM ...;
// In expressions: Pick(StatusFlag + 1, 'Inactive', 'Active', 'Pending')
```

### Compress Timestamps

```qlik
// ❌ Full timestamp with milliseconds (high cardinality)
LOAD Timestamp FROM ...;

// ✅ Round to hour (much fewer unique values)
LOAD Floor(Timestamp, 1/24) as TimestampHour FROM ...;

// ✅ Or separate into date + time period
LOAD
    Date(Floor(Timestamp)) as OrderDate,
    Hour(Timestamp) as OrderHour
FROM ...;
```

### Drop Unused Tables and Fields

```qlik
// Always clean up staging/temp tables
DROP TABLE _Staging;
DROP TABLE _Temp;

// Drop fields you don't need after transformation
DROP FIELD _TempField, _ProcessingFlag;
```

## Expression Performance

### Use Set Analysis Instead of If()

```qlik
// ❌ SLOW: If() inside aggregation
Sum(If(Year = 2024, Sales))

// ✅ FAST: Set analysis
Sum({<Year={2024}>} Sales)
```

Set analysis is optimized at the engine level; `If()` evaluates row-by-row.

### Use Pre-Calculated Flags

```qlik
// ❌ SLOW: Complex date calculation in every chart
Sum({<OrderDate={">=$(=Date(AddMonths(Today(),-12)))<=$(=Date(Today()))"}>} Sales)

// ✅ FAST: Flag calculated once in script
// Script: If(OrderDate >= AddMonths(Today(),-12) AND OrderDate <= Today(), 1, 0) as IsLast12Months
Sum({<IsLast12Months={1}>} Sales)
```

### Minimize AGGR()

```qlik
// ❌ SLOW: Nested AGGR
Avg(Aggr(Sum(Sales), CustomerID, ProductID))

// ✅ FASTER: Pre-aggregate in script
// Script:
// _PreAgg: LOAD CustomerID, ProductID, Sum(Sales) as CustProdSales
//          RESIDENT FactSales GROUP BY CustomerID, ProductID;
// Then in expression:
Avg(CustProdSales)
```

### Limit TOTAL Qualifier

```qlik
// ❌ SLOW: TOTAL recalculates for every cell
Sum(Sales) / Sum(TOTAL Sales)

// ✅ FASTER: Use a variable for the total
// Variable: vTotalSales = Sum({1} Sales)
Sum(Sales) / $(vTotalSales)
```

### Cache Expressions in Variables

```qlik
// Define reusable sub-expressions
SET vCYSales = Sum({<Year={$(=Max(Year))}>} Sales);
SET vPYSales = Sum({<Year={$(=Max(Year)-1)}>} Sales);

// Reuse in charts:
// Growth: ($(vCYSales) - $(vPYSales)) / $(vPYSales)
```

## Frontend Performance

### Reduce Objects Per Sheet

- Aim for **< 10 chart objects per sheet**
- Each object triggers an expression evaluation on every selection
- Use drill-down dimensions instead of many separate charts

### Limit Dimension Cardinality

```qlik
// ❌ Table with 100K rows of individual transactions
// ✅ Aggregate to customer/product/month level for table charts
```

### Use Calculation Conditions

```qlik
// Don't calculate until user makes a selection
=Count(DISTINCT Year) = 1
// Message: "Select a year to display this chart"
```

This prevents expensive calculations when all data is selected.

### Avoid Calculated Dimensions

```qlik
// ❌ SLOW: Calculated dimension
Year(OrderDate) & '-' & Month(OrderDate)

// ✅ FAST: Pre-calculated field from script
YearMonth  // Already computed during reload
```

## Diagnostic Queries

### Table Size Report
```qlik
// Add to end of script to monitor table sizes
FOR vT = 0 TO NoOfTables() - 1
    LET vName = TableName(vT);
    LET vRows = NoOfRows('$(vName)');
    LET vFields = NoOfFields('$(vName)');
    TRACE [PERF] $(vName): $(vRows) rows × $(vFields) fields;
NEXT vT
```

### Reload Time Per Section
```qlik
LET vSectionStart = Now();
// ... load section ...
LET vSectionTime = Interval(Now() - vSectionStart, 'mm:ss');
TRACE [PERF] Section took $(vSectionTime);
```

### Memory Estimation
```qlik
// Rough memory estimate: rows × fields × 20 bytes average
LET vEstMemMB = (NoOfRows('FactTable') * NoOfFields('FactTable') * 20) / 1048576;
TRACE [PERF] Estimated memory: $(vEstMemMB) MB for FactTable;
```

## Optimization Checklist

- [ ] Star schema (no synthetic keys, no circular references)
- [ ] Load only needed fields (no `LOAD *` from large tables)
- [ ] QVD loads are optimized (no WHERE or transforms on QVD reads)
- [ ] String keys replaced with Autonumber (for >1M rows)
- [ ] Timestamps rounded to appropriate granularity
- [ ] Temp/staging tables dropped
- [ ] Date flags pre-calculated in script (IsYTD, IsLast12Months, etc.)
- [ ] Set analysis used instead of If() in expressions
- [ ] AGGR() minimized (pre-aggregate in script where possible)
- [ ] < 10 chart objects per sheet
- [ ] Calculation conditions on heavy charts
- [ ] No calculated dimensions (use script-computed fields)

[See references/reload-optimization.md for detailed reload tuning]
[See references/memory-guide.md for memory reduction strategies]
