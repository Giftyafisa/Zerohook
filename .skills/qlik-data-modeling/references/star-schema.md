# Star Schema Patterns in Qlik

## Why Star Schema?

Qlik's associative engine works best with a **normalized star schema**:
- One central **fact table** with measures and foreign keys
- Surrounding **dimension tables** with descriptive attributes
- Each dimension connects to the fact via exactly one key

Benefits:
- No synthetic keys
- Predictable selection behavior
- Best performance
- Easiest to maintain

## Basic Star Schema

```
              DimCustomer
              %CustomerKey
                   │
DimProduct    FactSales     DimDate
%ProductKey───%CustomerKey───%DateKey
              %ProductKey
              %DateKey
              Amount
              Quantity
```

### Script Pattern

```qlik
///$tab Dimensions
DimCustomer:
LOAD
    CustomerID as %CustomerKey,
    CustomerName,
    Region,
    Segment,
    City,
    Country
FROM [lib://QVD/customers.qvd] (qvd);

DimProduct:
LOAD
    ProductID as %ProductKey,
    ProductName,
    Category,
    SubCategory,
    Brand,
    UnitCost
FROM [lib://QVD/products.qvd] (qvd);

///$tab Facts
FactSales:
LOAD
    OrderID,
    CustomerID as %CustomerKey,
    ProductID as %ProductKey,
    Date#(OrderDate, 'YYYY-MM-DD') as %DateKey,
    Quantity,
    UnitPrice,
    Quantity * UnitPrice as SalesAmount,
    Discount
FROM [lib://QVD/orders.qvd] (qvd);

///$tab Calendar
// MasterCalendar linked via %DateKey (see calendar-generation.md)
```

## Flattening Snowflake to Star

Databases often have normalized hierarchies. Flatten them for Qlik:

### Snowflake (Bad for Qlik)
```
Product → SubCategory → Category → Department
```

### Star (Good for Qlik)
```qlik
// Flatten the hierarchy into one dimension table
DimProduct:
LOAD
    p.ProductID as %ProductKey,
    p.ProductName,
    sc.SubCategoryName as SubCategory,
    c.CategoryName as Category,
    d.DepartmentName as Department
...
```

Or with ApplyMap:
```qlik
SubCatMap: MAPPING LOAD SubCategoryID, SubCategoryName FROM ...;
CatMap: MAPPING LOAD SubCategoryID, CategoryID FROM ...;
DeptMap: MAPPING LOAD CategoryID, DepartmentName FROM ...;

DimProduct:
LOAD
    ProductID as %ProductKey,
    ProductName,
    ApplyMap('SubCatMap', SubCategoryID, 'Unknown') as SubCategory,
    ApplyMap('CatMap', SubCategoryID, 'Unknown') as CategoryID,
    ApplyMap('DeptMap',
        ApplyMap('CatMap', SubCategoryID, ''),
        'Unknown') as Department
FROM [lib://QVD/products.qvd] (qvd);
```

## Multiple Fact Tables

When you have multiple facts (Sales, Budget, Inventory), you have two options:

### Option A: Shared Dimensions (If keys align)
```
              DimCustomer
                   │
FactSales     ─────┤
FactBudget    ─────┤
              DimProduct
```

This works ONLY if each fact shares exactly one key with each dimension. If facts share multiple keys, use a link table (see link-tables.md).

### Option B: Concatenated Fact Table
If facts have similar granularity, concatenate them:

```qlik
FactFinancial:
LOAD
    %CustomerKey,
    %ProductKey,
    %DateKey,
    Amount as SalesAmount,
    0 as BudgetAmount,
    'Actual' as DataType
FROM [lib://QVD/sales.qvd] (qvd);

CONCATENATE(FactFinancial)
LOAD
    %CustomerKey,
    %ProductKey,
    %DateKey,
    0 as SalesAmount,
    Amount as BudgetAmount,
    'Budget' as DataType
FROM [lib://QVD/budget.qvd] (qvd);
```

## Slowly Changing Dimensions (SCD)

### Type 1: Overwrite (Most Common in Qlik)
Just load the latest version. History is lost.

```qlik
DimCustomer:
LOAD %CustomerKey, CustomerName, CurrentRegion
FROM [lib://QVD/customers_latest.qvd] (qvd);
```

### Type 2: Track History
Keep all versions with validity dates:

```qlik
DimCustomer:
LOAD
    %CustomerKey & '|' & ValidFrom as %CustomerVersionKey,
    %CustomerKey,
    CustomerName,
    Region,
    ValidFrom,
    ValidTo,
    If(ValidTo = '9999-12-31', 1, 0) as IsCurrentVersion
FROM [lib://QVD/customers_history.qvd] (qvd);

// Fact links to %CustomerVersionKey (not just %CustomerKey)
// Use IntervalMatch for date-range matching
```

## Autonumber for Performance

For large models (>10M rows), convert string keys to integers:

```qlik
// After all tables are loaded:
Autonumber(%CustomerKey) as %CustomerKey;
Autonumber(%ProductKey) as %ProductKey;
```

**Caution:** Autonumber values change every reload. Don't store them in QVDs meant for incremental loads.

## Data Model Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Multiple shared fields | Synthetic keys | Rename or drop duplicates |
| Circular references | Qlik error / loose coupling | Link table or remove an association |
| Snowflake chains | Extra tables, slow selections | Flatten to star |
| No key prefix | Hard to identify associations | Use `%` prefix |
| Fact-to-fact direct link | Synthetic keys, wrong aggregations | Link table or concatenate |
| Loading all fields | Wasted memory | Load only needed fields |
