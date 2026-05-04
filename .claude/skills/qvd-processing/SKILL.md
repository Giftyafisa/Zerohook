---
name: qvd-processing
description: >
  Build QVD-based data architectures with incremental loads, staging layers,
  and optimized read patterns. Covers insert-only, insert+update, and
  insert+update+delete incremental strategies, QVD layer design, optimized
  vs standard load modes, and STORE patterns. Use when building ETL pipelines
  or working with QVD files in Qlik.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-core
---

# QVD Processing

## When to Use

- User is building or optimizing a data pipeline with QVD files
- User asks about incremental loads or reload performance
- User wants to set up Extract → Transform → QVD → App architecture
- User mentions "QVD", "incremental", "staging", "optimized load", or "STORE"
- User's reload is slow and needs performance optimization

## What Is a QVD?

QVD (Qlik View Data) is Qlik's native columnar file format. It is:
- **10-100x faster** to read than CSV/Excel/database sources
- **Compressed** — typically 10-20% of raw CSV size
- **Typed** — preserves field types, no re-parsing needed
- **Appendable** — supports incremental load patterns

## QVD Layer Architecture

Best practice is a 3-layer architecture:

```
Source (CSV/DB/API) → Extract QVD → Transform QVD → App Load
```

| Layer | Purpose | Frequency |
|---|---|---|
| **Extract** | Raw copy from source, minimal transformation | Scheduled (hourly/daily) |
| **Transform** | Business logic, lookups, calculations | After extract |
| **App** | Load from transform QVDs, build data model | On-demand |

**Why layers?**
- Extract isolates source systems (if DB is down, app still reloads from QVD)
- Transform centralizes business logic (multiple apps share the same QVDs)
- App loads are fast (QVD reads only, no external dependencies)

## Optimized vs Standard QVD Load

Qlik has two QVD read modes:

### Optimized Load (Fast)
The entire QVD is read as a binary block — **no row-by-row processing**.

**Triggers optimized mode:**
```qlik
// Full load — no transformations
LOAD * FROM [lib://QVD/data.qvd] (qvd);

// Field subset — no renaming, no calculations
LOAD Field1, Field2, Field3 FROM [lib://QVD/data.qvd] (qvd);
```

### Standard Load (Slow)
Falls back to row-by-row processing — 10-100x slower.

**Triggers standard mode (avoid when possible):**
```qlik
// WHERE clause forces standard mode
LOAD * FROM [lib://QVD/data.qvd] (qvd) WHERE Year = 2024;

// Renaming a field forces standard mode
LOAD Field1 as RenamedField FROM [lib://QVD/data.qvd] (qvd);

// Calculations force standard mode
LOAD *, Price * Qty as LineTotal FROM [lib://QVD/data.qvd] (qvd);

// Preceding LOAD forces standard mode on the inner LOAD
LOAD *, Price * Qty as LineTotal;
LOAD * FROM [lib://QVD/data.qvd] (qvd);
```

**Optimization strategy:** Load the QVD in optimized mode first, then transform with a RESIDENT load:

```qlik
// Step 1: Optimized QVD read (fast)
_Raw:
LOAD * FROM [lib://QVD/orders.qvd] (qvd);

// Step 2: Transform via RESIDENT (still fast, data already in memory)
Orders:
LOAD
    OrderID,
    CustomerID,
    Date#(OrderDate, 'YYYY-MM-DD') as OrderDate,
    Amount * TaxRate as TotalWithTax
RESIDENT _Raw
WHERE Year >= 2023;

DROP TABLE _Raw;
```

## STORE Statement

```qlik
// Store full table to QVD
STORE Orders INTO [lib://QVD/orders.qvd] (qvd);

// Store specific fields
STORE OrderID, CustomerID, Amount FROM Orders INTO [lib://QVD/orders_slim.qvd] (qvd);

// Store to CSV (for sharing with non-Qlik systems)
STORE Orders INTO [lib://Export/orders.csv] (txt);

// Store to subdirectory — folders are auto-created
STORE Forecast INTO [lib://QVD/analytics/forecast.qvd] (qvd);
```

**Note:** `STORE` automatically creates any subdirectories in the path. There is no need to manually create folders on the server before running `STORE`.

## Incremental Load Patterns

Incremental loads only process **new or changed** records, dramatically reducing reload time.

**Three patterns, increasing complexity:**

### Pattern 1: Insert-Only
For append-only data (logs, transactions, events).

```qlik
// Load existing QVD
_Existing:
LOAD * FROM [lib://QVD/transactions.qvd] (qvd);

LET vMaxDate = Peek('TransactionDate', NoOfRows('_Existing') - 1, '_Existing');
TRACE Last existing date: $(vMaxDate);

// Load only new records from source
_New:
LOAD *
FROM [lib://Source/transactions.csv]
(txt, utf8, embedded labels, delimiter is ',')
WHERE TransactionDate > '$(vMaxDate)';

TRACE New records: $(NoOfRows('_New'));

// Concatenate and store
CONCATENATE(_Existing) LOAD * RESIDENT _New;
DROP TABLE _New;

STORE _Existing INTO [lib://QVD/transactions.qvd] (qvd);
DROP TABLE _Existing;
```

### Pattern 2: Insert + Update
For data where existing records can change (orders with status updates).

```qlik
// Load existing QVD
_QVD:
LOAD * FROM [lib://QVD/orders.qvd] (qvd);

LET vMaxModified = Peek('ModifiedDate', NoOfRows('_QVD') - 1, '_QVD');

// Load new + modified records from source
_Source:
LOAD *
FROM [lib://Source/orders.csv]
(txt, utf8, embedded labels, delimiter is ',')
WHERE ModifiedDate > '$(vMaxModified)';

TRACE Changed records from source: $(NoOfRows('_Source'));

// Remove old versions of updated records from QVD
INNER JOIN(_Source) LOAD DISTINCT OrderID FROM _Source;

_Clean:
NOCONCATENATE LOAD * RESIDENT _QVD
WHERE NOT EXISTS(OrderID);
DROP TABLE _QVD;

// Combine clean existing + new/updated
CONCATENATE(_Clean) LOAD * RESIDENT _Source;
DROP TABLE _Source;

STORE _Clean INTO [lib://QVD/orders.qvd] (qvd);
DROP TABLE _Clean;
```

### Pattern 3: Insert + Update + Delete
For data where records can be removed from source.

```qlik
// Load full key list from source (lightweight query)
_SourceKeys:
LOAD DISTINCT OrderID
FROM [lib://Source/orders.csv]
(txt, utf8, embedded labels, delimiter is ',');

// Load existing QVD
_QVD:
LOAD * FROM [lib://QVD/orders.qvd] (qvd);

LET vMaxModified = Peek('ModifiedDate', NoOfRows('_QVD') - 1, '_QVD');

// Load new + modified records
_Changed:
LOAD *
FROM [lib://Source/orders.csv]
(txt, utf8, embedded labels, delimiter is ',')
WHERE ModifiedDate > '$(vMaxModified)';

// Keep only records that still exist in source AND haven't been updated
_Surviving:
NOCONCATENATE LOAD * RESIDENT _QVD
WHERE EXISTS(OrderID)           // Still in source (not deleted)
  AND NOT EXISTS(_ChangedKey);  // Not in the changed set
DROP TABLE _QVD;

// Merge surviving + changed
CONCATENATE(_Surviving) LOAD * RESIDENT _Changed;
DROP TABLE _Changed;
DROP TABLE _SourceKeys;

STORE _Surviving INTO [lib://QVD/orders.qvd] (qvd);
DROP TABLE _Surviving;
```

## Performance Tips

1. **Always use optimized loads** from QVD when possible — avoid WHERE, rename, or calculations on the QVD LOAD
2. **STORE intermediate results** — if a transform takes >30 seconds, store the result as a QVD
3. **Partition large QVDs** — split by year/month for faster incremental loads
4. **Use `EXISTS()`** for efficient key lookups instead of `WHERE ... IN`
5. **Monitor QVD file sizes** — a QVD growing unexpectedly may indicate a broken incremental load
6. **Use `NoOfRows()` and `TRACE`** to verify row counts after each incremental step

[See references/incremental-load.md for detailed incremental patterns]
[See references/qvd-layer-design.md for architecture guidance]
[See references/performance-guide.md for optimization techniques]
[See assets/ for ready-to-use incremental load templates]
