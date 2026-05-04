# Incremental Load Patterns — Deep Dive

## Why Incremental?

A full reload re-reads every record from source every time. For tables with millions of rows, this can take hours. Incremental loads process only **what changed**, reducing reload time from hours to minutes.

## Prerequisites

Every incremental load needs:
1. **A key field** — uniquely identifies each record (e.g., `OrderID`, `TransactionID`)
2. **A change indicator** — tells you what's new/modified (e.g., `ModifiedDate`, `CreatedAt`, auto-increment ID)
3. **An existing QVD** — the accumulated historical data

## Pattern 1: Insert-Only (Append)

**Use when:** Records are only ever added, never updated or deleted.
**Examples:** Transaction logs, sensor readings, web analytics events, audit trails.

### How It Works
1. Load the existing QVD
2. Find the high-water mark (max date or max ID)
3. Load only records from source where the change indicator > high-water mark
4. Concatenate new records onto existing
5. Store the combined result back to QVD

### Key Field: Date-Based
```qlik
_Existing:
LOAD * FROM [lib://QVD/events.qvd] (qvd);

// Get the latest date from existing data
// Sort the QVD by EventDate before storing to make Peek reliable
LET vMaxDate = Peek('EventDate', NoOfRows('_Existing') - 1, '_Existing');
TRACE High-water mark: $(vMaxDate);

_New:
LOAD *
FROM [lib://Source/events.csv]
(txt, utf8, embedded labels, delimiter is ',')
WHERE EventDate > '$(vMaxDate)';

LET vNewRows = NoOfRows('_New');
TRACE New rows to append: $(vNewRows);

IF vNewRows > 0 THEN
    CONCATENATE(_Existing) LOAD * RESIDENT _New;
    DROP TABLE _New;
    STORE _Existing INTO [lib://QVD/events.qvd] (qvd);
ELSE
    DROP TABLE _New;
    TRACE No new records found;
END IF

DROP TABLE _Existing;
```

### Key Field: Auto-Increment ID
```qlik
_Existing:
LOAD * FROM [lib://QVD/transactions.qvd] (qvd);

LET vMaxID = Peek('TransactionID', NoOfRows('_Existing') - 1, '_Existing');
TRACE Last ID: $(vMaxID);

_New:
LOAD *
FROM [lib://Source/transactions.csv]
(txt, utf8, embedded labels, delimiter is ',')
WHERE TransactionID > $(vMaxID);

CONCATENATE(_Existing) LOAD * RESIDENT _New;
DROP TABLE _New;

STORE _Existing INTO [lib://QVD/transactions.qvd] (qvd);
DROP TABLE _Existing;
```

### First Run (No Existing QVD)
```qlik
// Check if QVD exists
LET vQvdExists = IF(FileSize('lib://QVD/events.qvd') > 0, 1, 0);

IF vQvdExists = 1 THEN
    // Incremental path
    _Existing:
    LOAD * FROM [lib://QVD/events.qvd] (qvd);
    LET vMaxDate = Peek('EventDate', NoOfRows('_Existing') - 1, '_Existing');

    _New:
    LOAD * FROM [lib://Source/events.csv]
    (txt, utf8, embedded labels, delimiter is ',')
    WHERE EventDate > '$(vMaxDate)';

    CONCATENATE(_Existing) LOAD * RESIDENT _New;
    DROP TABLE _New;
ELSE
    // Full initial load
    TRACE First run — performing full load;
    _Existing:
    LOAD * FROM [lib://Source/events.csv]
    (txt, utf8, embedded labels, delimiter is ',');
END IF

STORE _Existing INTO [lib://QVD/events.qvd] (qvd);
DROP TABLE _Existing;
```

---

## Pattern 2: Insert + Update

**Use when:** Existing records can be modified but never deleted.
**Examples:** Orders (status changes), customer profiles, product catalog updates.

### How It Works
1. Load the existing QVD
2. Find the high-water mark on `ModifiedDate`
3. Load records from source where `ModifiedDate > high-water mark`
4. Remove old versions of changed records from QVD (using key field)
5. Concatenate updated records
6. Store result

```qlik
// Load existing
_QVD:
LOAD * FROM [lib://QVD/orders.qvd] (qvd);

LET vMaxMod = Peek('ModifiedDate', NoOfRows('_QVD') - 1, '_QVD');
TRACE High-water mark: $(vMaxMod);

// Load changed records from source
_Changed:
LOAD *
FROM [lib://Source/orders.csv]
(txt, utf8, embedded labels, delimiter is ',')
WHERE ModifiedDate > '$(vMaxMod)';

LET vChangedRows = NoOfRows('_Changed');
TRACE Changed records: $(vChangedRows);

IF vChangedRows > 0 THEN
    // Build a key table of changed IDs
    _ChangedKeys:
    LOAD DISTINCT OrderID as _ChangedOrderID RESIDENT _Changed;

    // Keep only unchanged records from QVD
    _Unchanged:
    NOCONCATENATE LOAD * RESIDENT _QVD
    WHERE NOT EXISTS(_ChangedOrderID, OrderID);
    DROP TABLE _QVD;
    DROP TABLE _ChangedKeys;

    // Merge unchanged + changed
    CONCATENATE(_Unchanged) LOAD * RESIDENT _Changed;
    DROP TABLE _Changed;

    STORE _Unchanged INTO [lib://QVD/orders.qvd] (qvd);
    DROP TABLE _Unchanged;
ELSE
    DROP TABLE _Changed;
    DROP TABLE _QVD;
    TRACE No changes detected;
END IF
```

### Important: Sort by ModifiedDate Before Storing
For `Peek()` to work correctly as a high-water mark, the QVD should be sorted:

```qlik
_Sorted:
NOCONCATENATE LOAD * RESIDENT _Combined ORDER BY ModifiedDate;
DROP TABLE _Combined;
STORE _Sorted INTO [lib://QVD/orders.qvd] (qvd);
DROP TABLE _Sorted;
```

---

## Pattern 3: Insert + Update + Delete

**Use when:** Records can be added, changed, AND removed from source.
**Examples:** Active employee list, current inventory, live product catalog.

### How It Works
1. Load **all keys** from source (lightweight — just the ID column)
2. Load the existing QVD
3. Load changed records (same as Pattern 2)
4. From QVD, keep only records whose key still exists in source AND hasn't been updated
5. Concatenate surviving + changed
6. Store result

```qlik
// Step 1: Get current source keys (lightweight)
_SourceKeys:
LOAD DISTINCT OrderID as _SourceOrderID
FROM [lib://Source/orders.csv]
(txt, utf8, embedded labels, delimiter is ',');

LET vSourceKeyCount = NoOfRows('_SourceKeys');
TRACE Source contains $(vSourceKeyCount) active records;

// Step 2: Load existing QVD
_QVD:
LOAD * FROM [lib://QVD/orders.qvd] (qvd);

LET vQvdCount = NoOfRows('_QVD');
LET vMaxMod = Peek('ModifiedDate', vQvdCount - 1, '_QVD');

// Step 3: Load changed records
_Changed:
LOAD *
FROM [lib://Source/orders.csv]
(txt, utf8, embedded labels, delimiter is ',')
WHERE ModifiedDate > '$(vMaxMod)';

_ChangedKeys:
LOAD DISTINCT OrderID as _ChangedOrderID RESIDENT _Changed;

// Step 4: Keep records that STILL EXIST in source AND are NOT changed
_Surviving:
NOCONCATENATE LOAD * RESIDENT _QVD
WHERE EXISTS(_SourceOrderID, OrderID)     // Still in source
  AND NOT EXISTS(_ChangedOrderID, OrderID); // Not updated
DROP TABLE _QVD;

LET vDeleted = vQvdCount - NoOfRows('_Surviving') - NoOfRows('_Changed');
TRACE Deleted records: $(vDeleted);

// Step 5: Merge
CONCATENATE(_Surviving) LOAD * RESIDENT _Changed;
DROP TABLE _Changed;
DROP TABLE _ChangedKeys;
DROP TABLE _SourceKeys;

STORE _Surviving INTO [lib://QVD/orders.qvd] (qvd);
DROP TABLE _Surviving;
```

---

## Troubleshooting Incremental Loads

| Symptom | Cause | Fix |
|---|---|---|
| Duplicate records after reload | Key field not unique | Add `DISTINCT` or check source for duplicates |
| Missing records | High-water mark skipping records | Use `>=` instead of `>` (handle duplicates separately) |
| QVD grows indefinitely | Insert-only on data that should use insert+update | Switch to Pattern 2 |
| `Peek()` returns wrong value | QVD not sorted by change indicator | Add `ORDER BY` before `STORE` |
| First run fails | No existing QVD file | Add `FileSize()` check for first-run detection |
| Records reappearing after delete | Using Pattern 1 instead of Pattern 3 | Switch to insert+update+delete pattern |

## Monitoring

Always add TRACE statements to verify your incremental loads:

```qlik
TRACE ========================================;
TRACE Incremental Load Summary;
TRACE QVD before: $(vQvdCount) rows;
TRACE Changed: $(vChangedRows) rows;
TRACE Deleted: $(vDeleted) rows;
TRACE QVD after: $(NoOfRows('_Result')) rows;
TRACE ========================================;
```
