---
name: qlik-app-optimization
description: >
  Analyze and optimize Qlik apps for size, speed, and memory efficiency.
  Covers unused field detection, synthetic key elimination, data model
  restructuring, field type optimization, redundant table removal, and
  script cleanup. Leverages MCP tools (get_available_fields, get_tables_and_keys,
  get_script) to perform real analysis on connected apps. Use when an app
  is too large, slow, or needs a data model review.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-optimization
---

# Qlik App Optimization

## When to Use

- User says their app is too large, slow, or using too much memory
- User asks to optimize or clean up a Qlik app
- User mentions unused fields, synthetic keys, or data model issues
- User wants to reduce app size for publishing or sharing
- AI has MCP access to inspect app structure and suggest specific fixes

## MCP-Driven Optimization Workflow

When the AI has access to the Qlik MCP server, follow this workflow:

### Step 1: Inspect the Data Model
```
Tool: get_tables_and_keys(app_id)
→ Returns: tables, fields, keys, relationships
→ Look for: synthetic keys, island tables, circular references
```

### Step 2: Analyze Fields
```
Tool: get_available_fields(app_id)
→ Returns: field names, cardinality, tags, source tables, sample values
→ Look for: high-cardinality fields, unused fields, redundant fields
```

### Step 3: Review the Script
```
Tool: get_script(app_id)
→ Returns: full load script
→ Look for: LOAD *, unused transformations, missing WHERE clauses,
   unoptimized QVD loads, missing DROP TABLE statements
```

### Step 4: Recommend & Apply Fixes
```
Tool: set_script(app_id, script)
→ Apply the optimized script
Tool: reload_app(app_id)
→ Reload to verify improvements
```

## Unused Field Detection

### How to Identify Unused Fields

Fields are "unused" if they are:
1. **Not in any chart expression** (measure or dimension)
2. **Not used in set analysis** or calculated dimensions
3. **Not a key field** linking tables
4. **Not referenced by variables** or master items

### Using MCP to Find Unused Fields

After calling `get_available_fields`, cross-reference with the script:

```
Fields loaded:    50 fields across 5 tables
Fields in charts: 25 fields (check sheet objects)
Key fields:       5 fields (linking tables)
→ Potentially unused: 20 fields (candidates for removal)
```

### Removing Unused Fields

```qlik
// ❌ BEFORE: Loading everything
Orders:
LOAD * FROM [lib://QVD/orders.qvd] (qvd);

// ✅ AFTER: Load only what's needed
Orders:
LOAD
    OrderID,          // Key field
    CustomerID,       // Key field
    OrderDate,        // Used in charts
    Amount,           // Used in measures
    Quantity          // Used in measures
    // Removed: ShipAddress, ShipCity, ShipPostalCode, 
    //          InternalNotes, AuditTrail, XMLPayload
FROM [lib://QVD/orders.qvd] (qvd);
```

### Script Pattern: Dynamic Field Selection
```qlik
// Define used fields per table (easy to maintain)
SET vOrderFields = OrderID, CustomerID, OrderDate, Amount, Quantity;
SET vCustomerFields = CustomerID, CustomerName, Region, Segment;

Orders:
LOAD $(vOrderFields) FROM [lib://QVD/orders.qvd] (qvd);

Customers:
LOAD $(vCustomerFields) FROM [lib://QVD/customers.qvd] (qvd);
```

## Synthetic Key Elimination

Synthetic keys occur when two or more tables share multiple fields.

### Detection via MCP
```
Tool: get_tables_and_keys(app_id)
→ Look for tables named "$Syn 1", "$Syn 2", etc.
→ Identify which fields are causing the synthetic key
```

### Fix Strategies

#### Strategy 1: Qualify Fields
```qlik
// Before the load that causes synthetic keys
QUALIFY *;
UNQUALIFY CustomerID;  // Keep the intended key unqualified

Customers:
LOAD * FROM [lib://QVD/customers.qvd] (qvd);

QUALIFY *;
UNQUALIFY OrderID, CustomerID;

Orders:
LOAD * FROM [lib://QVD/orders.qvd] (qvd);

UNQUALIFY *;  // Reset for remaining tables
```

#### Strategy 2: Rename Conflicting Fields
```qlik
// If both Customers and Orders have a "Name" field
Customers:
LOAD
    CustomerID,
    Name as CustomerName,    // Rename to avoid conflict
    Region
FROM [lib://QVD/customers.qvd] (qvd);

Orders:
LOAD
    OrderID,
    CustomerID,
    Name as OrderName,       // Different name
    Amount
FROM [lib://QVD/orders.qvd] (qvd);
```

#### Strategy 3: Composite Key
```qlik
// If tables legitimately share multiple key fields, create a composite key
Orders:
LOAD
    *,
    CustomerID & '|' & OrderDate as %OrderKey
FROM [lib://QVD/orders.qvd] (qvd);

OrderDetails:
LOAD
    *,
    CustomerID & '|' & OrderDate as %OrderKey
FROM [lib://QVD/order_details.qvd] (qvd);

// Drop the individual fields that were causing the synthetic key
DROP FIELDS CustomerID, OrderDate FROM OrderDetails;
```

#### Strategy 4: Drop the Redundant Field
```qlik
// If a field is loaded in multiple tables but only needed in one
Orders:
LOAD * FROM [lib://QVD/orders.qvd] (qvd);

// Drop Region from Orders — it's already in Customers (linked by CustomerID)
DROP FIELD Region FROM Orders;
```

## Island Table Detection

Island tables are tables with no connections to the rest of the data model.

### Detection
```
Tool: get_tables_and_keys(app_id)
→ Tables with 0 key connections = island tables
```

### Common Causes
1. **Mapping tables not dropped** — forgot `DROP TABLE` after ApplyMap
2. **Config/metadata tables** — intentionally disconnected (OK)
3. **Naming mismatch** — key field name doesn't match between tables
4. **Temporary tables** — staging tables not cleaned up

### Fix
```qlik
// If it's a stale mapping table, drop it
DROP TABLE _RegionMapping;

// If key fields don't match, rename to connect
Products:
LOAD
    ProductCode as ProductID,  // Rename to match Orders.ProductID
    ProductName,
    Category
FROM [lib://QVD/products.qvd] (qvd);
```

## Field Type Optimization

### String to Number Conversion
```qlik
// High-cardinality string keys → Autonumber
LOAD
    Autonumber(TransactionGUID) as TransactionID,  // 36-char GUID → integer
    Autonumber(SessionID) as SessionKey,            // Long string → integer
    Amount,
    OrderDate
FROM [lib://QVD/transactions.qvd] (qvd);
```

### Timestamp Reduction
```qlik
// Millisecond timestamps → Date or Hour granularity
LOAD
    Date(Floor(EventTimestamp)) as EventDate,       // Daily granularity
    Hour(EventTimestamp) as EventHour,              // Optional hour bucket
    // EventTimestamp,                              // Drop full timestamp
    EventType,
    UserID
FROM [lib://QVD/events.qvd] (qvd);
```

### Flag Optimization
```qlik
// Text status → Numeric flag
LOAD
    OrderID,
    If(Status = 'Active', 1, 0) as IsActive,       // 'Active'/'Inactive' → 1/0
    If(Priority = 'High', 1, If(Priority = 'Medium', 2, 3)) as PriorityCode,
    Amount
FROM [lib://QVD/orders.qvd] (qvd);

// Display in charts: Pick(PriorityCode, 'High', 'Medium', 'Low')
```

## Redundant Table & Field Removal

### Detect Redundant Fields (Same Data in Multiple Tables)
```qlik
// If "Region" is in both Customers and Orders:
// - Keep it in Customers (dimension table)
// - Remove from Orders (fact table) — it's reachable via CustomerID
DROP FIELD Region FROM Orders;
```

### Merge Small Lookup Tables
```qlik
// Instead of 5 tiny lookup tables, use ApplyMap
_StatusMap:
MAPPING LOAD StatusCode, StatusName FROM [lib://QVD/status_lookup.qvd] (qvd);

_PriorityMap:
MAPPING LOAD PriorityCode, PriorityName FROM [lib://QVD/priority_lookup.qvd] (qvd);

// Apply during fact table load — no extra tables in the model
Orders:
LOAD
    *,
    ApplyMap('_StatusMap', StatusCode, 'Unknown') as StatusName,
    ApplyMap('_PriorityMap', PriorityCode, 'Unknown') as PriorityName
FROM [lib://QVD/orders.qvd] (qvd);
```

## Script Cleanup Patterns

### Remove LOAD *
```qlik
// ❌ Loads everything (including unused fields)
LOAD * FROM [lib://QVD/big_table.qvd] (qvd);

// ✅ Explicit field list
LOAD
    KeyField,
    Measure1,
    Measure2,
    DimensionField
FROM [lib://QVD/big_table.qvd] (qvd);
```

### Ensure QVD Loads Are Optimized
```qlik
// ❌ WHERE breaks QVD optimization
LOAD * FROM [lib://QVD/data.qvd] (qvd) WHERE Year = 2024;

// ✅ Load then filter (optimized QVD read + RESIDENT filter)
_Raw: LOAD * FROM [lib://QVD/data.qvd] (qvd);
Data: NOCONCATENATE LOAD * RESIDENT _Raw WHERE Year = 2024;
DROP TABLE _Raw;
```

### Drop Staging Tables
```qlik
// Always clean up intermediate tables
_Staging:
LOAD * FROM [lib://Source/raw.csv] (txt, utf8, embedded labels, delimiter is ',');

_Transformed:
NOCONCATENATE LOAD
    *,
    Year(OrderDate) as Year,
    Month(OrderDate) as Month
RESIDENT _Staging;

DROP TABLE _Staging;  // ← Don't forget this!
```

## App Size Analysis Script

Add to end of any script to get a size breakdown:

```qlik
///$tab Optimization-Report
TRACE ============================================;
TRACE APP OPTIMIZATION REPORT;
TRACE ============================================;

LET vTotalRows = 0;
LET vTotalFields = 0;
LET vTableCount = NoOfTables();

FOR vT = 0 TO vTableCount - 1
    LET vTName = TableName(vT);
    LET vTRows = NoOfRows('$(vTName)');
    LET vTFields = NoOfFields('$(vTName)');
    LET vTotalRows = vTotalRows + vTRows;
    LET vTotalFields = vTotalFields + vTFields;
    
    // Estimate memory (rough: rows × fields × 20 bytes)
    LET vEstMB = Round((vTRows * vTFields * 20) / 1048576, 0.1);
    
    TRACE   $(vTName): $(vTRows) rows × $(vTFields) fields (~$(vEstMB) MB);
NEXT vT

TRACE ============================================;
TRACE   Total: $(vTotalRows) rows, $(vTotalFields) fields, $(vTableCount) tables;

// Check for high-cardinality fields
TRACE ============================================;
TRACE HIGH CARDINALITY FIELDS (>10K unique values):;
TRACE ============================================;

FOR vT = 0 TO vTableCount - 1
    LET vTName = TableName(vT);
    FOR vF = 1 TO NoOfFields('$(vTName)')
        LET vFName = FieldName(vF, '$(vTName)');
        LET vCard = FieldValueCount('$(vFName)');
        IF vCard > 10000 THEN
            LET vRows = NoOfRows('$(vTName)');
            LET vPct = Round(vCard / vRows * 100, 0.1);
            TRACE   $(vTName).$(vFName): $(vCard) unique ($(vPct)% of rows);
        END IF
    NEXT vF
NEXT vT

TRACE ============================================;
```

## Optimization Checklist (MCP-Assisted)

When the AI has MCP access, work through this checklist:

1. **`get_tables_and_keys`** →
   - [ ] No synthetic keys
   - [ ] No island tables (unless intentional)
   - [ ] Star schema structure (facts → dimensions)
   - [ ] No circular references

2. **`get_available_fields`** →
   - [ ] No fields with >90% unique values (unless necessary)
   - [ ] Key fields have matching names across tables
   - [ ] No duplicate field names across unrelated tables
   - [ ] Sample values look clean (no junk data)

3. **`get_script`** →
   - [ ] No `LOAD *` from large tables
   - [ ] QVD loads are optimized (no WHERE on QVD reads)
   - [ ] Staging/temp tables are dropped
   - [ ] Mapping loads used instead of JOINs for lookups
   - [ ] No redundant field loading across tables
   - [ ] TRACE statements present for monitoring

4. **After optimization** →
   - [ ] `set_script` with cleaned script
   - [ ] `reload_app` to apply changes
   - [ ] `get_tables_and_keys` to verify improved model
   - [ ] Compare before/after: table count, field count, row count

[See references/optimization-patterns.md for advanced techniques]
[See assets/ for optimization report templates]
