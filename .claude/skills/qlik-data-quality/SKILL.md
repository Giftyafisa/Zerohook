---
name: qlik-data-quality
description: >
  Implement data quality checks, validation, and profiling in Qlik load
  scripts. Covers null detection, duplicate identification, referential
  integrity checks, data type validation, outlier detection, completeness
  scoring, and automated quality reporting. Use when building data
  pipelines that need quality gates or when debugging data issues.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-data
---

# Qlik Data Quality

## When to Use

- User needs to validate data during reload
- User asks about null handling, duplicates, or data profiling
- User wants quality gates that stop reload on bad data
- User mentions referential integrity, orphan records, or data completeness
- User needs to audit data quality across tables
- AI has access to `get_available_fields` and `get_tables_and_keys` MCP tools to inspect existing data models

## MCP-Assisted Analysis

**When the AI has MCP access to the Qlik environment**, it can:
1. **`get_available_fields`** — See all fields, cardinality, tags, and sample values
2. **`get_tables_and_keys`** — See table structure, key fields, synthetic keys
3. **`get_script`** — Read the current load script to identify quality gaps
4. **`apply_selections`** — Test data by selecting specific values

Use these tools to identify quality issues before writing fixes.

## Null Detection & Handling

### Count Nulls Per Field
```qlik
// After loading a table, check for nulls
_NullCheck:
LOAD
    'Customers' as TableName,
    'CustomerName' as FieldName,
    Count(If(IsNull(CustomerName) OR Len(Trim(CustomerName)) = 0, 1)) as NullCount,
    Count(*) as TotalRows,
    Count(If(IsNull(CustomerName) OR Len(Trim(CustomerName)) = 0, 1)) / Count(*) as NullPct
RESIDENT Customers;

TRACE Null check — CustomerName: $(=Peek('NullCount',0,'_NullCheck')) nulls out of $(=Peek('TotalRows',0,'_NullCheck'));
DROP TABLE _NullCheck;
```

### Comprehensive Null Audit (All Fields)
```qlik
SUB AuditNulls(vTableName)
    LET vFieldCount = NoOfFields('$(vTableName)');
    LET vRowCount = NoOfRows('$(vTableName)');
    
    TRACE [QUALITY] Null audit for $(vTableName) ($(vRowCount) rows, $(vFieldCount) fields);
    
    FOR vF = 1 TO vFieldCount
        LET vFieldName = FieldName(vF, '$(vTableName)');
        
        _NullCount:
        LOAD
            Count(If(IsNull([$(vFieldName)]) OR Len(Trim([$(vFieldName)])) = 0, 1)) as NullCount
        RESIDENT [$(vTableName)];
        
        LET vNulls = Peek('NullCount', 0, '_NullCount');
        DROP TABLE _NullCount;
        
        IF vNulls > 0 THEN
            LET vPct = Round(vNulls / vRowCount * 100, 0.1);
            TRACE [QUALITY]   $(vFieldName): $(vNulls) nulls ($(vPct)%);
        END IF
    NEXT vF
END SUB

CALL AuditNulls('Customers');
CALL AuditNulls('Orders');
```

### Null Replacement Patterns
```qlik
// Replace nulls during load
LOAD
    CustomerID,
    If(IsNull(CustomerName) OR Len(Trim(CustomerName)) = 0, 
       'Unknown', CustomerName) as CustomerName,
    If(IsNull(Region), 'Unassigned', Region) as Region,
    If(IsNull(Revenue), 0, Revenue) as Revenue,
    If(IsNull(OrderDate), Date#('1900-01-01','YYYY-MM-DD'), OrderDate) as OrderDate
FROM [lib://Data/customers.csv]
(txt, utf8, embedded labels, delimiter is ',');
```

## Duplicate Detection

### Simple Duplicate Check
```qlik
_DupCheck:
LOAD
    CustomerID,
    Count(*) as OccurrenceCount
RESIDENT Customers
GROUP BY CustomerID;

_Duplicates:
NOCONCATENATE LOAD
    CustomerID,
    OccurrenceCount
RESIDENT _DupCheck
WHERE OccurrenceCount > 1;

LET vDupCount = NoOfRows('_Duplicates');
TRACE [QUALITY] Duplicate CustomerIDs: $(vDupCount);

IF vDupCount > 0 THEN
    TRACE [QUALITY] WARNING: $(vDupCount) duplicate keys found in Customers;
END IF

DROP TABLES _DupCheck, _Duplicates;
```

### Composite Key Duplicate Check
```qlik
// Check for duplicates on composite key
_CompositeDups:
LOAD
    CustomerID & '|' & OrderDate as CompositeKey,
    Count(*) as Cnt
RESIDENT Orders
GROUP BY CustomerID & '|' & OrderDate;

LET vDups = 0;
_DupResults:
LOAD CompositeKey, Cnt RESIDENT _CompositeDups WHERE Cnt > 1;
LET vDups = NoOfRows('_DupResults');

IF vDups > 0 THEN
    TRACE [QUALITY] WARNING: $(vDups) duplicate CustomerID+OrderDate combinations;
END IF

DROP TABLES _CompositeDups, _DupResults;
```

### Deduplication Patterns
```qlik
// Keep first occurrence (by date)
_Deduped:
LOAD
    CustomerID,
    FirstSortedValue(CustomerName, OrderDate) as CustomerName,
    FirstSortedValue(Region, OrderDate) as Region,
    Min(OrderDate) as FirstOrderDate,
    Max(OrderDate) as LastOrderDate,
    Sum(Revenue) as TotalRevenue
RESIDENT _RawCustomers
GROUP BY CustomerID;

// Keep latest record
_Latest:
LOAD * RESIDENT _RawData
WHERE RecNo() = 
    Peek('_RowNum', 0, '_RankTable');
// Or use a preceding load with ranking
```

## Referential Integrity

### Check Foreign Key References
```qlik
SUB CheckReferentialIntegrity(vFactTable, vFkField, vDimTable, vPkField)
    // Find orphan records (FK values not in dimension)
    _FkValues:
    LOAD DISTINCT [$(vFkField)] as _FK RESIDENT [$(vFactTable)];
    
    _PkValues:
    LOAD DISTINCT [$(vPkField)] as _PK RESIDENT [$(vDimTable)];
    
    _Orphans:
    NOCONCATENATE LOAD _FK
    RESIDENT _FkValues
    WHERE NOT Exists(_PK, _FK);
    
    LET vOrphanCount = NoOfRows('_Orphans');
    
    IF vOrphanCount > 0 THEN
        TRACE [QUALITY] WARNING: $(vOrphanCount) orphan records in $(vFactTable).$(vFkField) not found in $(vDimTable).$(vPkField);
    ELSE
        TRACE [QUALITY] OK: $(vFactTable).$(vFkField) → $(vDimTable).$(vPkField) — all references valid;
    END IF
    
    DROP TABLES _FkValues, _PkValues, _Orphans;
END SUB

// Usage
CALL CheckReferentialIntegrity('Orders', 'CustomerID', 'Customers', 'CustomerID');
CALL CheckReferentialIntegrity('Orders', 'ProductID', 'Products', 'ProductID');
CALL CheckReferentialIntegrity('OrderLines', 'OrderID', 'Orders', 'OrderID');
```

## Data Type Validation

### Validate Numeric Fields
```qlik
_NumericCheck:
LOAD
    Count(If(NOT IsNum(Revenue), 1)) as NonNumericCount,
    Count(*) as TotalRows
RESIDENT Orders;

LET vBadNums = Peek('NonNumericCount', 0, '_NumericCheck');
IF vBadNums > 0 THEN
    TRACE [QUALITY] WARNING: $(vBadNums) non-numeric values in Revenue field;
END IF
DROP TABLE _NumericCheck;
```

### Validate Date Fields
```qlik
_DateCheck:
LOAD
    Count(If(IsNull(Date#(OrderDate, 'YYYY-MM-DD')), 1)) as InvalidDateCount,
    Count(If(Year(OrderDate) < 2000 OR OrderDate > Today(), 1)) as OutOfRangeCount,
    Min(OrderDate) as MinDate,
    Max(OrderDate) as MaxDate,
    Count(*) as TotalRows
RESIDENT Orders;

LET vBadDates = Peek('InvalidDateCount', 0, '_DateCheck');
LET vMinDate = Peek('MinDate', 0, '_DateCheck');
LET vMaxDate = Peek('MaxDate', 0, '_DateCheck');

TRACE [QUALITY] Dates — Range: $(vMinDate) to $(vMaxDate), Invalid: $(vBadDates);
DROP TABLE _DateCheck;
```

### Validate Email Format
```qlik
_EmailCheck:
LOAD
    Count(If(
        NOT WildMatch(Email, '*@*.*') OR 
        Len(Email) < 5 OR 
        SubStringCount(Email, '@') <> 1,
        1)) as InvalidEmailCount,
    Count(*) as TotalRows
RESIDENT Customers;

LET vBadEmails = Peek('InvalidEmailCount', 0, '_EmailCheck');
TRACE [QUALITY] Invalid emails: $(vBadEmails);
DROP TABLE _EmailCheck;
```

## Outlier Detection

### Statistical Outlier Check (IQR Method)
```qlik
// Detect outliers using Interquartile Range
_Stats:
LOAD
    Fractile(Revenue, 0.25) as Q1,
    Fractile(Revenue, 0.75) as Q3
RESIDENT Orders;

LET vQ1 = Peek('Q1', 0, '_Stats');
LET vQ3 = Peek('Q3', 0, '_Stats');
LET vIQR = vQ3 - vQ1;
LET vLowerBound = vQ1 - (1.5 * vIQR);
LET vUpperBound = vQ3 + (1.5 * vIQR);

DROP TABLE _Stats;

_Outliers:
LOAD
    Count(If(Revenue < $(vLowerBound) OR Revenue > $(vUpperBound), 1)) as OutlierCount,
    Count(*) as TotalRows
RESIDENT Orders;

LET vOutliers = Peek('OutlierCount', 0, '_Outliers');
TRACE [QUALITY] Revenue outliers (IQR): $(vOutliers) (bounds: $(vLowerBound) to $(vUpperBound));
DROP TABLE _Outliers;
```

### Range Validation
```qlik
// Business rule: Age must be 0-120, Price must be > 0
_RangeCheck:
LOAD
    Count(If(Age < 0 OR Age > 120, 1)) as BadAge,
    Count(If(Price <= 0, 1)) as BadPrice,
    Count(If(Quantity < 0, 1)) as NegativeQty
RESIDENT Orders;

LET vBadAge = Peek('BadAge', 0, '_RangeCheck');
LET vBadPrice = Peek('BadPrice', 0, '_RangeCheck');
LET vNegQty = Peek('NegativeQty', 0, '_RangeCheck');

IF vBadAge > 0 THEN TRACE [QUALITY] WARNING: $(vBadAge) invalid age values; END IF
IF vBadPrice > 0 THEN TRACE [QUALITY] WARNING: $(vBadPrice) non-positive prices; END IF
IF vNegQty > 0 THEN TRACE [QUALITY] WARNING: $(vNegQty) negative quantities; END IF

DROP TABLE _RangeCheck;
```

## Completeness Scoring

### Per-Row Completeness
```qlik
// Calculate how complete each row is
LOAD
    *,
    (If(NOT IsNull(CustomerName), 1, 0) +
     If(NOT IsNull(Email), 1, 0) +
     If(NOT IsNull(Phone), 1, 0) +
     If(NOT IsNull(Address), 1, 0) +
     If(NOT IsNull(Region), 1, 0)) / 5 as CompletenessScore
FROM [lib://Data/customers.csv]
(txt, utf8, embedded labels, delimiter is ',');
```

### Table-Level Completeness Report
```qlik
SUB CompletenessReport(vTableName)
    LET vFieldCount = NoOfFields('$(vTableName)');
    LET vRowCount = NoOfRows('$(vTableName)');
    LET vTotalCells = vFieldCount * vRowCount;
    LET vNullCells = 0;
    
    FOR vF = 1 TO vFieldCount
        LET vFieldName = FieldName(vF, '$(vTableName)');
        
        _FC:
        LOAD Count(If(IsNull([$(vFieldName)]), 1)) as NC RESIDENT [$(vTableName)];
        LET vNullCells = vNullCells + Peek('NC', 0, '_FC');
        DROP TABLE _FC;
    NEXT vF
    
    LET vCompleteness = Round((1 - (vNullCells / vTotalCells)) * 100, 0.1);
    TRACE [QUALITY] $(vTableName) completeness: $(vCompleteness)% ($(vNullCells) null cells out of $(vTotalCells));
END SUB

CALL CompletenessReport('Customers');
CALL CompletenessReport('Orders');
```

## Quality Gate Pattern

Stop reload if data quality thresholds are not met:

```qlik
LET vQualityPass = 1;

// Check 1: Minimum row count
LET vRows = NoOfRows('Orders');
IF vRows < 1000 THEN
    TRACE [QUALITY GATE FAIL] Orders has only $(vRows) rows (minimum: 1000);
    LET vQualityPass = 0;
END IF

// Check 2: Null rate on critical field
_NC:
LOAD Count(If(IsNull(CustomerID), 1)) / Count(*) as NullRate RESIDENT Orders;
LET vNullRate = Peek('NullRate', 0, '_NC');
DROP TABLE _NC;

IF vNullRate > 0.01 THEN
    TRACE [QUALITY GATE FAIL] CustomerID null rate $(vNullRate) exceeds 1% threshold;
    LET vQualityPass = 0;
END IF

// Check 3: No duplicate keys
_DC:
LOAD Count(*) - Count(DISTINCT OrderID) as DupCount RESIDENT Orders;
LET vDups = Peek('DupCount', 0, '_DC');
DROP TABLE _DC;

IF vDups > 0 THEN
    TRACE [QUALITY GATE FAIL] $(vDups) duplicate OrderIDs found;
    LET vQualityPass = 0;
END IF

// Final gate
IF vQualityPass = 0 THEN
    TRACE [QUALITY GATE] RELOAD ABORTED — quality checks failed;
    EXIT SCRIPT;
ELSE
    TRACE [QUALITY GATE] All checks passed — proceeding;
END IF
```

## Quality Dashboard Expressions

Build a data quality dashboard with these chart expressions:

```qlik
// Null rate for a field
Count(If(IsNull(CustomerName), 1)) / Count(CustomerID)

// Completeness %
1 - (Count(If(IsNull(CustomerName), 1)) / Count(CustomerID))

// Duplicate rate
(Count(CustomerID) - Count(DISTINCT CustomerID)) / Count(CustomerID)

// Freshness (days since last record)
Today() - Max(OrderDate)

// Row count trend (by reload date)
Count(OrderID)
// With dimension: ReloadDate
```

## Consistency Checks

### Cross-Source Validation
```qlik
// Compare row counts between source and QVD
_SourceCount:
LOAD Count(*) as SourceRows FROM [lib://Source/orders.csv]
(txt, utf8, embedded labels, delimiter is ',');

_QvdCount:
LOAD Count(*) as QvdRows FROM [lib://QVD/orders.qvd] (qvd);

LET vSourceRows = Peek('SourceRows', 0, '_SourceCount');
LET vQvdRows = Peek('QvdRows', 0, '_QvdCount');

IF vSourceRows <> vQvdRows THEN
    TRACE [QUALITY] Row count mismatch: Source=$(vSourceRows), QVD=$(vQvdRows);
END IF

DROP TABLES _SourceCount, _QvdCount;
```

### Sum Validation
```qlik
// Verify totals match between source and loaded data
_SourceTotal:
LOAD Sum(Amount) as SourceTotal FROM [lib://Source/orders.csv]
(txt, utf8, embedded labels, delimiter is ',');

LET vSourceTotal = Peek('SourceTotal', 0, '_SourceTotal');
DROP TABLE _SourceTotal;

_LoadedTotal:
LOAD Sum(Amount) as LoadedTotal RESIDENT Orders;

LET vLoadedTotal = Peek('LoadedTotal', 0, '_LoadedTotal');
DROP TABLE _LoadedTotal;

LET vDiff = Abs(vSourceTotal - vLoadedTotal);
IF vDiff > 0.01 THEN
    TRACE [QUALITY] Amount total mismatch: Source=$(vSourceTotal), Loaded=$(vLoadedTotal), Diff=$(vDiff);
END IF
```

[See references/profiling-patterns.md for data profiling techniques]
[See assets/ for ready-to-use quality check templates]
