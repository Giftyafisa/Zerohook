# Advanced Optimization Patterns

## ApplyMap vs JOIN

JOINs add fields by matching rows between tables — they're expensive for large tables. ApplyMap is a lightweight lookup alternative.

### When to Use ApplyMap
```qlik
// ❌ SLOW: JOIN creates a temporary merged table
Customers:
LOAD * FROM [lib://QVD/customers.qvd] (qvd);

LEFT JOIN(Customers)
LOAD RegionID, RegionName FROM [lib://QVD/regions.qvd] (qvd);

// ✅ FAST: Mapping load + ApplyMap (no table merge)
_RegionMap:
MAPPING LOAD RegionID, RegionName FROM [lib://QVD/regions.qvd] (qvd);

Customers:
LOAD
    *,
    ApplyMap('_RegionMap', RegionID, 'Unknown') as RegionName
FROM [lib://QVD/customers.qvd] (qvd);
```

**Rule of thumb:** Use ApplyMap when adding 1-2 fields from a lookup table. Use JOIN only when merging many fields.

### Multiple ApplyMaps
```qlik
_StatusMap: MAPPING LOAD Code, Label FROM [lib://QVD/status.qvd] (qvd);
_PriorityMap: MAPPING LOAD Code, Label FROM [lib://QVD/priority.qvd] (qvd);
_CategoryMap: MAPPING LOAD Code, Label FROM [lib://QVD/category.qvd] (qvd);

Orders:
LOAD
    *,
    ApplyMap('_StatusMap', StatusCode, 'Unknown') as StatusName,
    ApplyMap('_PriorityMap', PriorityCode, 'N/A') as PriorityName,
    ApplyMap('_CategoryMap', CategoryCode, 'Uncategorized') as CategoryName
FROM [lib://QVD/orders.qvd] (qvd);
```

## Pre-Aggregation

Move heavy calculations from chart expressions to the load script.

### Before (Slow Chart Expressions)
```qlik
// Chart expression calculates per customer every time:
// Avg(Aggr(Sum(Sales), CustomerID))
```

### After (Pre-Aggregated in Script)
```qlik
// Pre-aggregate in script
_CustomerSales:
LOAD
    CustomerID,
    Sum(Amount) as CustomerTotalSales,
    Count(DISTINCT OrderID) as CustomerOrderCount,
    Sum(Amount) / Count(DISTINCT OrderID) as CustomerAOV
RESIDENT FactOrders
GROUP BY CustomerID;

// Join back to dimension
LEFT JOIN(DimCustomers)
LOAD * RESIDENT _CustomerSales;
DROP TABLE _CustomerSales;

// Now chart expression is simple and fast:
// Avg(CustomerTotalSales)
```

### Pre-Calculate Date Flags
```qlik
// Add to master calendar — evaluated once during reload, not per chart render
MasterCalendar:
LOAD
    DateKey as %DateKey,
    Date,
    Year,
    Month,
    MonthName,
    // Flags (pre-calculated)
    If(Year = Year(Today()) AND Month <= Month(Today()), 1, 0) as IsYTD,
    If(Year = Year(Today()) - 1 AND Month <= Month(Today()), 1, 0) as IsPrevYTD,
    If(Date >= AddMonths(Today(), -12), 1, 0) as IsLast12Months,
    If(Date >= MonthStart(Today()), 1, 0) as IsMTD,
    If(Date >= Today() - 30, 1, 0) as IsLast30Days,
    If(Date >= Today() - 7, 1, 0) as IsLast7Days
RESIDENT _CalendarBase;
```

## NOCONCATENATE Discipline

Qlik auto-concatenates tables with identical field structures. This can silently merge tables you intended to keep separate.

```qlik
// ❌ Risk: If _FilteredOrders has same fields as Orders, they merge
_FilteredOrders:
LOAD * RESIDENT Orders WHERE Region = 'North';

// ✅ Safe: Explicitly prevent auto-concatenation
_FilteredOrders:
NOCONCATENATE LOAD * RESIDENT Orders WHERE Region = 'North';
```

**Rule:** Always use `NOCONCATENATE` on RESIDENT loads that create new tables.

## Fact Table Thinning

Keep fact tables as thin as possible — only keys and measures.

```qlik
// ❌ FAT fact table (descriptive fields belong in dimensions)
FactOrders:
LOAD
    OrderID,
    CustomerID,
    CustomerName,      // ← Move to DimCustomers
    CustomerRegion,    // ← Move to DimCustomers
    ProductID,
    ProductName,       // ← Move to DimProducts
    ProductCategory,   // ← Move to DimProducts
    OrderDate,
    Amount,
    Quantity,
    Discount
FROM ...;

// ✅ THIN fact table (only keys + measures)
FactOrders:
LOAD
    OrderID,
    CustomerID,        // Key → DimCustomers
    ProductID,         // Key → DimProducts
    OrderDate as %DateKey,  // Key → MasterCalendar
    Amount,
    Quantity,
    Discount
FROM ...;
```

## Garbage Collection: Clean Variable Namespace

```qlik
// After using temp variables, clean them up
LET vTempFile = Null();
LET vTempRows = Null();
LET vTempIdx = Null();

// Or use a cleanup subroutine
SUB CleanupVars()
    LET vI = Null();
    LET vFile = Null();
    LET vRows = Null();
    LET vTemp = Null();
END SUB
```

## Incremental Model Updates

Instead of reloading the entire model, update only changed data:

```qlik
// 1. Load existing QVD (optimized read — fast)
_Existing:
LOAD * FROM [lib://QVD/orders.qvd] (qvd);

// 2. Get max date from existing data
LET vMaxDate = Peek('OrderDate', NoOfRows('_Existing') - 1, '_Existing');

// 3. Load only new records from source
_New:
LOAD * FROM [lib://Source/orders.csv]
(txt, utf8, embedded labels, delimiter is ',')
WHERE OrderDate > '$(vMaxDate)';

// 4. Combine
CONCATENATE(_Existing) LOAD * RESIDENT _New;
DROP TABLE _New;

// 5. Store updated QVD
STORE _Existing INTO [lib://QVD/orders.qvd] (qvd);
RENAME TABLE _Existing TO Orders;
```

## Binary Load for Speed

If one app generates QVDs and another consumes them, consider Binary load for the fastest possible start:

```qlik
// Loads the ENTIRE data model from another app in one statement
// Much faster than loading individual QVDs
BINARY [lib://Apps/DataModel.qvf];

// Then add app-specific logic on top
```

**Limitations:** Binary must be the first statement. Only one Binary per script. No field selection.

## Memory-Efficient String Handling

```qlik
// ❌ Long descriptions consume memory
LOAD ProductDescription FROM ...;  // 500-char strings × 100K products = ~50MB

// ✅ Truncate if only used for display
LOAD Left(ProductDescription, 100) as ProductDescription FROM ...;

// ✅ Or load only when needed (separate table with drill-down)
// Keep detail in a separate "on-demand" table
```

## Benchmark Your Optimization

```qlik
// Add to script to track optimization impact over time
_OptimizationLog:
LOAD * INLINE [
    Metric, Value
    ReloadDate, '$(=Date(Today()))'
    TableCount, '$(=NoOfTables())'
    TotalRows, '$(vTotalRows)'
    TotalFields, '$(vTotalFields)'
    ReloadDuration, '$(vTotalTime)'
];

STORE _OptimizationLog INTO [lib://Logs/optimization_$(=Date(Today(),'YYYYMMDD')).qvd] (qvd);
DROP TABLE _OptimizationLog;
```
