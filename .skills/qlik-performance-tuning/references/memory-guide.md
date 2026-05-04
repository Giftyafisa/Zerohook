# Memory Optimization Guide

## How Qlik Uses Memory

Qlik stores the entire data model **in RAM**. Memory usage depends on:
1. **Number of rows** — More rows = more memory
2. **Number of fields** — Each field has overhead
3. **Cardinality** — Unique values per field (biggest factor)
4. **Data types** — Numbers < short strings < long strings

## Memory Estimation

Rough formula:
```
Memory ≈ Σ (unique_values × avg_value_size + row_count × pointer_size)
```

For practical estimation:
- **Integer field**: ~8 bytes per unique value + 4 bytes per row
- **Short string (<20 chars)**: ~30 bytes per unique value + 4 bytes per row
- **Long string (>100 chars)**: ~120+ bytes per unique value + 4 bytes per row
- **Date/timestamp**: ~12 bytes per unique value + 4 bytes per row

## High-Impact Reductions

### 1. Drop Unused Fields
```qlik
// Identify what's not used in charts, then don't load it
LOAD
    OrderID,       // Needed
    CustomerID,    // Needed
    Amount,        // Needed
    // AuditTrail, // Not used → don't load
    // InternalID, // Not used → don't load
    // XMLPayload, // Not used → don't load
FROM ...;
```

### 2. Reduce String Cardinality
```qlik
// ❌ 500K unique full addresses
LOAD Address FROM ...;

// ✅ Split into components (fewer unique values each)
LOAD City, State, ZipCode FROM ...;
// Or don't load if not needed for analysis
```

### 3. Autonumber String Keys
```qlik
// ❌ 1M unique GUIDs like "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
// Each ~40 bytes × 1M = ~40 MB just for this field

// ✅ Autonumber: 1M integers × 8 bytes = ~8 MB
LOAD Autonumber(TransactionGUID) as TransactionID FROM ...;
```

### 4. Round Timestamps
```qlik
// ❌ Millisecond precision: 86,400,000 unique values per day
LOAD Timestamp FROM ...;

// ✅ Hourly: 24 unique values per day
LOAD Floor(Timestamp, 1/24) as TimestampHour FROM ...;

// ✅ Daily: 1 unique value per day
LOAD Date(Floor(Timestamp)) as EventDate FROM ...;
```

### 5. Use Numeric Flags
```qlik
// ❌ Text: 'Active' (6 bytes), 'Inactive' (8 bytes), 'Pending' (7 bytes)
LOAD Status FROM ...;

// ✅ Numeric: 1, 0, 2 (4 bytes each)
LOAD
    If(Status = 'Active', 1, If(Status = 'Pending', 2, 0)) as StatusCode
FROM ...;
```

### 6. Remove Redundant Data
```qlik
// ❌ Loading the same data at multiple granularities
LOAD OrderDate, MonthStart(OrderDate) as MonthStart, Year(OrderDate) as Year FROM ...;
// Year and MonthStart are derivable from OrderDate

// ✅ Derive in master calendar instead (loaded once)
// MasterCalendar already has Year, Month, etc.
LOAD OrderDate as %DateKey FROM ...;
```

## Monitoring Memory Usage

### Script-Based Estimate
```qlik
SUB EstimateMemory(vTableName)
    LET vRows = NoOfRows('$(vTableName)');
    LET vFields = NoOfFields('$(vTableName)');
    
    LET vEstBytes = 0;
    FOR vF = 1 TO vFields
        LET vFName = FieldName(vF, '$(vTableName)');
        LET vCardinality = FieldValueCount('$(vFName)');
        // Rough: 30 bytes per unique value + 4 bytes per row
        LET vFieldMem = (vCardinality * 30) + (vRows * 4);
        LET vEstBytes = vEstBytes + vFieldMem;
    NEXT vF
    
    LET vEstMB = Round(vEstBytes / 1048576, 0.1);
    TRACE [MEMORY] $(vTableName): ~$(vEstMB) MB ($(vRows) rows × $(vFields) fields);
END SUB

CALL EstimateMemory('FactSales');
CALL EstimateMemory('DimCustomers');
```

### Data Model Viewer
Use the Data Model Viewer after reload to see:
- Table sizes (rows × fields)
- Field cardinality
- Memory usage per table (Qlik Cloud shows this)

## When to Split Apps

If a single app exceeds available memory:

1. **Extract layer** — Separate app that generates QVDs
2. **Transform layer** — Separate app that transforms QVDs
3. **Presentation layer** — User-facing app that loads transformed QVDs

This keeps each app within memory limits and allows independent scheduling.
