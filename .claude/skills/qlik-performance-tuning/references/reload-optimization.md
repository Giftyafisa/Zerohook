# Reload Optimization Guide

## Measuring Reload Performance

### Timing Each Section
```qlik
LET vScriptStart = Now();

///$tab Extract
LET vSectionStart = Now();
// ... extract code ...
LET vExtractTime = Interval(Now() - vSectionStart, 'hh:mm:ss');
TRACE [TIMER] Extract: $(vExtractTime);

///$tab Transform
LET vSectionStart = Now();
// ... transform code ...
LET vTransformTime = Interval(Now() - vSectionStart, 'hh:mm:ss');
TRACE [TIMER] Transform: $(vTransformTime);

///$tab Load
LET vSectionStart = Now();
// ... load code ...
LET vLoadTime = Interval(Now() - vSectionStart, 'hh:mm:ss');
TRACE [TIMER] Load: $(vLoadTime);

LET vTotalTime = Interval(Now() - vScriptStart, 'hh:mm:ss');
TRACE [TIMER] Total reload: $(vTotalTime);
```

## QVD Read Optimization

### What Makes a QVD Load "Optimized"?

An optimized QVD load reads the file in its native binary format without any row-by-row processing. This is **10-100x faster** than a standard load.

**Optimized conditions (ALL must be true):**
1. No `WHERE` clause
2. No field transformations (calculations, functions)
3. No preceding `LOAD` statement
4. Reading from a single QVD file
5. Field renaming with `as` IS allowed
6. Field selection (subset of fields) IS allowed

### Speed Comparison (Typical)

| Load Type | 10M Rows | Speed |
|---|---|---|
| Optimized QVD | 2-5 seconds | Binary read |
| Standard QVD (WHERE) | 30-120 seconds | Row-by-row |
| CSV file | 60-300 seconds | Parse + convert |
| Database (SQL) | 120-600 seconds | Network + parse |

### Keeping Loads Optimized

```qlik
// ✅ Optimized: field selection
LOAD OrderID, CustomerID, Amount
FROM [lib://QVD/orders.qvd] (qvd);

// ✅ Optimized: field rename
LOAD OrderID as %OrderKey, Amount as SalesAmount
FROM [lib://QVD/orders.qvd] (qvd);

// ❌ Not optimized: WHERE clause
LOAD * FROM [lib://QVD/orders.qvd] (qvd) WHERE Year = 2024;

// ✅ Workaround: load then filter
_All: LOAD * FROM [lib://QVD/orders.qvd] (qvd);
Orders: NOCONCATENATE LOAD * RESIDENT _All WHERE Year = 2024;
DROP TABLE _All;
```

## Database Load Optimization

### Reduce Network Transfer
```qlik
// ❌ Load everything, filter in Qlik
LOAD * FROM ...;
// SQL SELECT * FROM large_table;

// ✅ Filter in the database
SQL SELECT OrderID, CustomerID, Amount, OrderDate
FROM orders
WHERE OrderDate >= '2023-01-01';
```

### Use WHERE in SQL, Not Qlik
```qlik
// ❌ Qlik WHERE on database load (still transfers all rows)
LOAD * WHERE Year > 2020;
SQL SELECT * FROM orders;

// ✅ SQL WHERE (database filters first)
SQL SELECT * FROM orders WHERE YEAR(OrderDate) > 2020;
```

### Batch Large Loads
```qlik
// Split large tables into smaller loads by date range
FOR vYear = 2020 TO 2024
    CONCATENATE(AllOrders)
    SQL SELECT * FROM orders WHERE YEAR(OrderDate) = $(vYear);
    TRACE Loaded year $(vYear);
NEXT vYear
```

## Incremental Loads for Speed

Instead of full reloads, only load new/changed data:

```
Full reload:  Load ALL 50M rows every time     → 30 min
Incremental:  Load 50K new rows + merge         → 2 min
```

See the `qvd-processing` skill for detailed incremental load patterns.

## Concatenation vs Join Performance

```qlik
// CONCATENATE is fast (append rows)
CONCATENATE(MainTable) LOAD * FROM [lib://QVD/new_data.qvd] (qvd);

// JOIN is slower (match + merge fields)
JOIN(MainTable) LOAD CustomerID, Region FROM [lib://QVD/regions.qvd] (qvd);

// ApplyMap is faster than JOIN for lookups
RegionMap: MAPPING LOAD CustomerID, Region FROM [lib://QVD/regions.qvd] (qvd);
// Then: ApplyMap('RegionMap', CustomerID, 'Unknown') as Region
```

**Rule:** Use `ApplyMap` instead of `JOIN` for adding single fields from lookup tables.

## NOCONCATENATE

Always use `NOCONCATENATE` when creating a new table from RESIDENT to prevent accidental auto-concatenation:

```qlik
// ❌ Might auto-concatenate if field names match another table
Filtered: LOAD * RESIDENT _Raw WHERE Status = 'Active';

// ✅ Explicit: never auto-concatenate
Filtered: NOCONCATENATE LOAD * RESIDENT _Raw WHERE Status = 'Active';
```

## Parallel Processing Tips

1. **Independent QVD loads** can run in parallel on multi-core engines
2. **Keep STORE operations after all LOADs** — STORE blocks the engine
3. **Avoid sequential dependencies** where possible
4. **Use separate extract/transform/load tabs** for clarity
