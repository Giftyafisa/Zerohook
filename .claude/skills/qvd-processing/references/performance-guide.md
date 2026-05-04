# QVD Performance Guide

## Optimized Load — The #1 Performance Rule

QVD files support two read modes. Understanding the difference is critical.

### Optimized Load (10-100x faster)
The QVD is read as a binary block with no row-by-row processing.

**Conditions for optimized load:**
- `LOAD *` or `LOAD Field1, Field2` (field subset OK)
- No `WHERE` clause
- No field renaming (`as`)
- No calculated fields
- No preceding LOAD
- No `ORDER BY`

```qlik
// ✅ Optimized
LOAD * FROM [lib://QVD/data.qvd] (qvd);

// ✅ Optimized (field subset)
LOAD CustomerID, Name, Region FROM [lib://QVD/customers.qvd] (qvd);
```

### Standard Load (Falls back to slow mode)
Any transformation triggers row-by-row processing.

```qlik
// ❌ Standard — WHERE clause
LOAD * FROM [lib://QVD/data.qvd] (qvd) WHERE Year = 2024;

// ❌ Standard — field rename
LOAD CustomerID, customer_name as CustomerName FROM [lib://QVD/data.qvd] (qvd);

// ❌ Standard — calculation
LOAD *, Qty * Price as Total FROM [lib://QVD/data.qvd] (qvd);

// ❌ Standard — preceding LOAD
LOAD *, Qty * Price as Total;
LOAD * FROM [lib://QVD/data.qvd] (qvd);
```

### The Fix: Two-Step Pattern
```qlik
// Step 1: Optimized read
_Raw:
LOAD * FROM [lib://QVD/orders.qvd] (qvd);

// Step 2: Transform in memory (fast, data already loaded)
Orders:
NOCONCATENATE LOAD
    OrderID,
    CustomerID,
    Qty * Price as Total
RESIDENT _Raw
WHERE Year >= 2023;

DROP TABLE _Raw;
```

## Field-Level Optimization

### Load Only What You Need
```qlik
// ❌ Loading 200 fields when you need 5
LOAD * FROM [lib://QVD/huge_table.qvd] (qvd);

// ✅ Load only required fields (still optimized!)
LOAD OrderID, CustomerID, OrderDate, Amount, Status
FROM [lib://QVD/huge_table.qvd] (qvd);
```

### DROP Unused Fields
```qlik
// After loading, drop fields only used for intermediate calculations
DROP FIELD _TempCalcField, _LookupKey;
```

## Table-Level Optimization

### DROP Tables Immediately
```qlik
// ❌ Temp table sitting in memory until end of script
TempCalc:
LOAD *, Price * Qty as Total RESIDENT Orders;
// ... 500 lines of other code ...
// TempCalc is still consuming RAM!

// ✅ Drop immediately after use
TempCalc:
LOAD *, Price * Qty as Total RESIDENT Orders;

FinalOrders:
LOAD * RESIDENT TempCalc;
DROP TABLE TempCalc;  // Free memory NOW
```

### Use ApplyMap Instead of JOIN
For simple key→value lookups, `ApplyMap` is faster and uses less memory:

```qlik
// ❌ JOIN (creates full table copy in memory)
Orders: LOAD * FROM [lib://QVD/orders.qvd] (qvd);
LEFT JOIN(Orders) LOAD CustomerID, CustomerName FROM [lib://QVD/customers.qvd] (qvd);

// ✅ ApplyMap (memory-efficient lookup)
CustomerMap:
MAPPING LOAD CustomerID, CustomerName FROM [lib://QVD/customers.qvd] (qvd);

Orders:
LOAD
    *,
    ApplyMap('CustomerMap', CustomerID, 'Unknown') as CustomerName
FROM [lib://QVD/orders.qvd] (qvd);
```

**When to use JOIN vs ApplyMap:**
| Scenario | Use |
|---|---|
| Single field lookup | `ApplyMap` |
| Multiple fields from same table | `JOIN` |
| Many-to-many relationship | `JOIN` |
| Large dimension table (>1M rows) | `ApplyMap` (much less memory) |

### Use EXISTS() for Efficient Filtering
```qlik
// ❌ Slow — subquery-style
Orders:
LOAD * FROM [lib://QVD/orders.qvd] (qvd)
WHERE CustomerID IN (SELECT CustomerID FROM ActiveCustomers);

// ✅ Fast — EXISTS() checks an in-memory hash
ActiveCustomers:
LOAD DISTINCT CustomerID FROM [lib://QVD/active_customers.qvd] (qvd);

Orders:
LOAD * FROM [lib://QVD/orders.qvd] (qvd)
WHERE EXISTS(CustomerID);

// Note: EXISTS() forces standard mode on QVD load.
// If the QVD is large, use the two-step pattern instead.
```

## QVD File Management

### Partition Large QVDs by Time
```qlik
// Instead of one massive orders.qvd:
STORE _Orders2023 INTO [lib://QVD/orders_2023.qvd] (qvd);
STORE _Orders2024 INTO [lib://QVD/orders_2024.qvd] (qvd);

// Load only what's needed
Orders:
LOAD * FROM [lib://QVD/orders_2024.qvd] (qvd);  // Optimized, fast
CONCATENATE(Orders)
LOAD * FROM [lib://QVD/orders_2023.qvd] (qvd);   // Optimized, fast
```

### Monitor QVD Sizes
```qlik
LET vQvdSize = FileSize('lib://QVD/orders.qvd');
LET vQvdSizeMB = Round(vQvdSize / 1048576, 0.1);
TRACE QVD size: $(vQvdSizeMB) MB;
```

### Check QVD Freshness
```qlik
LET vQvdTime = FileTime('lib://QVD/orders.qvd');
LET vQvdAge = Now() - vQvdTime;
TRACE QVD last modified: $(vQvdTime) ($(vQvdAge) days ago);

IF vQvdAge > 2 THEN
    TRACE WARNING: QVD is more than 2 days old!;
END IF
```

## Benchmarking

Add timing to your script to identify bottlenecks:

```qlik
LET vStepStart = Now();

// ... your load operation ...

LET vStepEnd = Now();
LET vDuration = Interval(vStepEnd - vStepStart, 'hh:mm:ss');
TRACE Step completed in $(vDuration);
```

## Quick Reference: Performance Checklist

- [ ] All QVD loads are optimized (no WHERE/rename/calc on QVD LOAD)
- [ ] Using two-step pattern for QVDs that need filtering
- [ ] Loading only required fields
- [ ] Dropping temporary tables immediately after use
- [ ] Using ApplyMap for simple lookups
- [ ] Using EXISTS() for key-based filtering
- [ ] Large QVDs are partitioned by time period
- [ ] TRACE statements confirm row counts at each step
- [ ] No unnecessary CONCATENATE or JOIN operations
