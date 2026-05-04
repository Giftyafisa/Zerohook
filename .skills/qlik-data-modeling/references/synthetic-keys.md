# Synthetic Keys — Complete Guide

## What Is a Synthetic Key?

When two tables share **two or more** identically named fields, Qlik automatically creates a **synthetic key** — a hidden compound key that concatenates the shared fields.

Example:
```
Table A: CustomerID, Region, Sales
Table B: CustomerID, Region, Budget
→ Qlik creates: $Syn 1 Table = CustomerID | Region
```

## Why Are Synthetic Keys Bad?

1. **Performance** — Compound keys are slower than simple keys
2. **Unexpected behavior** — Selecting "North" in Region filters both tables through the compound key, which may not be the intended association
3. **Confusing model** — Synthetic keys hide the true data relationships
4. **Memory** — Extra synthetic table consumes RAM

## How to Detect

1. **Data Model Viewer** — Look for tables named `$Syn 1`, `$Syn 2`, etc.
2. **Reload log** — Warning messages about synthetic keys
3. **Script analysis** — Look for tables that share multiple field names

## Resolution Strategies

### Strategy 1: Rename the Conflicting Field

The simplest fix. If both tables have `Region` but it means different things:

```qlik
// Before (creates synthetic key)
Customers: LOAD CustomerID, Region, Name FROM ...;
Orders: LOAD CustomerID, Region, Amount FROM ...;

// After (no synthetic key)
Customers: LOAD CustomerID as %CustomerKey, Region as CustomerRegion, Name FROM ...;
Orders: LOAD CustomerID as %CustomerKey, Region as OrderRegion, Amount FROM ...;
```

### Strategy 2: Drop the Duplicate Field

If the field is truly the same data, load it from only one table:

```qlik
// Before
Customers: LOAD CustomerID, Region, Name FROM ...;
Orders: LOAD CustomerID, Region, OrderDate, Amount FROM ...;

// After — Region only from Customers
Customers: LOAD CustomerID as %CustomerKey, Region, Name FROM ...;
Orders: LOAD CustomerID as %CustomerKey, OrderDate, Amount FROM ...;
// Users can still see Region for any order (through %CustomerKey association)
```

### Strategy 3: Create an Explicit Composite Key

When you genuinely need a multi-field key:

```qlik
// Create a single composite key field
Customers:
LOAD
    CustomerID & '|' & Region as %CustRegionKey,
    CustomerID,
    Region,
    Name
FROM ...;

Orders:
LOAD
    CustomerID & '|' & Region as %CustRegionKey,
    OrderDate,
    Amount
FROM ...;
// Single shared field: %CustRegionKey — no synthetic key
```

### Strategy 4: QUALIFY / UNQUALIFY

Automatically prefix field names with table name to prevent collisions:

```qlik
QUALIFY *;             // All fields get table prefix
UNQUALIFY %*;          // Except key fields starting with %

Customers:
LOAD
    CustomerID as %CustomerKey,
    Region,
    Name
FROM ...;

Orders:
LOAD
    CustomerID as %CustomerKey,
    Region,
    Amount
FROM ...;

UNQUALIFY *;           // Reset

// Result:
// Customers.Region (unique to Customers)
// Orders.Region (unique to Orders)
// %CustomerKey (shared — links the tables)
```

### Strategy 5: Use a Mapping Table

If one of the shared fields is a lookup value:

```qlik
// Before: Both tables have CustomerID and CountryCode
Customers: LOAD CustomerID, CountryCode, Name FROM ...;
Orders: LOAD CustomerID, CountryCode, Amount FROM ...;

// After: Map CountryCode from Orders via Customers
CountryMap:
MAPPING LOAD CustomerID, CountryCode FROM [lib://Data/customers.qvd] (qvd);

Customers:
LOAD CustomerID as %CustomerKey, CountryCode, Name FROM ...;

Orders:
LOAD
    CustomerID as %CustomerKey,
    ApplyMap('CountryMap', CustomerID, '') as OrderCountryCode,  // Renamed
    Amount
FROM ...;
```

## Common Synthetic Key Scenarios

### Scenario: Date + Key in Multiple Tables
```qlik
// Sales has: ProductID, Date, Amount
// Inventory has: ProductID, Date, StockLevel
// → Synthetic key on ProductID + Date

// Fix: Create composite key
Sales:
LOAD
    ProductID & '|' & Date as %ProductDateKey,
    Amount
FROM ...;

Inventory:
LOAD
    ProductID & '|' & Date as %ProductDateKey,
    StockLevel
FROM ...;
```

### Scenario: System Fields (CreatedBy, ModifiedDate)
```qlik
// Multiple tables have CreatedBy, ModifiedDate from database
// → Synthetic keys everywhere

// Fix: QUALIFY these system fields
QUALIFY CreatedBy, ModifiedDate, CreatedDate, ModifiedBy;

// ... load all tables ...

UNQUALIFY *;
```

### Scenario: Same Dimension Used Twice (Role-Playing Dimension)
```qlik
// Orders has: OrderDate, ShipDate — both link to DimDate
// → Need two separate date dimensions

DimOrderDate:
LOAD
    DateKey as %OrderDateKey,
    Year as OrderYear,
    Month as OrderMonth
FROM [lib://QVD/calendar.qvd] (qvd);

DimShipDate:
LOAD
    DateKey as %ShipDateKey,
    Year as ShipYear,
    Month as ShipMonth
FROM [lib://QVD/calendar.qvd] (qvd);

FactOrders:
LOAD
    OrderID,
    OrderDate as %OrderDateKey,
    ShipDate as %ShipDateKey,
    Amount
FROM ...;
```

## Prevention Checklist

- [ ] Each table pair shares exactly ONE field
- [ ] Key fields use `%` prefix and are uniquely named
- [ ] System/audit fields (CreatedBy, etc.) are qualified or dropped
- [ ] Role-playing dimensions use separate copies with renamed fields
- [ ] Check Data Model Viewer after every reload
- [ ] No `$Syn` tables visible in the model
