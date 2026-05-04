# Link Tables in Qlik

## When to Use Link Tables

Link tables solve scenarios where:
1. **Multiple fact tables** share the same dimensions → would create synthetic keys
2. **Many-to-many relationships** exist between tables
3. **Circular references** need to be broken

## The Problem: Multiple Fact Tables

```qlik
// Sales and Budget both have ProductID, DateKey, RegionKey
FactSales: LOAD ProductID, DateKey, RegionKey, SalesAmount FROM ...;
FactBudget: LOAD ProductID, DateKey, RegionKey, BudgetAmount FROM ...;
// → THREE synthetic keys: $Syn 1, $Syn 2, $Syn 3
```

## The Solution: Link Table

Create a single table that holds all unique dimension key combinations, with a composite link key:

```qlik
///$tab Build-Link-Table

// Step 1: Collect all dimension key combinations from ALL fact tables
_AllKeys:
LOAD DISTINCT
    ProductID,
    DateKey,
    RegionKey
FROM [lib://QVD/sales.qvd] (qvd);

CONCATENATE(_AllKeys)
LOAD DISTINCT
    ProductID,
    DateKey,
    RegionKey
FROM [lib://QVD/budget.qvd] (qvd);

// Step 2: Create the link table with composite key
LinkTable:
LOAD DISTINCT
    ProductID & '|' & DateKey & '|' & RegionKey as %LinkKey,
    ProductID as %ProductKey,
    DateKey as %DateKey,
    RegionKey as %RegionKey
RESIDENT _AllKeys;

DROP TABLE _AllKeys;

///$tab Load-Facts

// Step 3: Load fact tables with ONLY the composite link key + measures
FactSales:
LOAD
    ProductID & '|' & DateKey & '|' & RegionKey as %LinkKey,
    SalesAmount,
    Quantity
FROM [lib://QVD/sales.qvd] (qvd);

FactBudget:
LOAD
    ProductID & '|' & DateKey & '|' & RegionKey as %LinkKey,
    BudgetAmount
FROM [lib://QVD/budget.qvd] (qvd);

///$tab Load-Dimensions

// Step 4: Dimensions connect to LinkTable (not directly to facts)
DimProduct:
LOAD ProductID as %ProductKey, ProductName, Category
FROM [lib://QVD/products.qvd] (qvd);

DimDate:
LOAD * FROM [lib://QVD/master_calendar.qvd] (qvd);
// %DateKey links to LinkTable

DimRegion:
LOAD RegionKey as %RegionKey, RegionName, Country
FROM [lib://QVD/regions.qvd] (qvd);
```

**Resulting model:**
```
DimProduct ── LinkTable ── DimDate
     %ProductKey  │  %DateKey
                  │
           FactSales (%LinkKey)
           FactBudget (%LinkKey)
                  │
              DimRegion
              %RegionKey
```

## Generic Link Table Pattern

For cases with many shared dimensions:

```qlik
SUB BuildLinkTable(vFactTables, vDimFields)
    // vFactTables = comma-separated list of fact table QVD paths
    // vDimFields = comma-separated list of shared dimension fields

    _AllCombinations:
    FOR EACH vTable IN $(vFactTables)
        CONCATENATE(_AllCombinations)
        LOAD DISTINCT $(vDimFields) FROM [$(vTable)] (qvd);
    NEXT

    LinkTable:
    LOAD DISTINCT
        $(vDimFields),
        // Create composite key from all dimension fields
        AutoNumber($(vDimFields)) as %LinkKey
    RESIDENT _AllCombinations;

    DROP TABLE _AllCombinations;
END SUB
```

## Link Table vs Concatenated Fact

| Approach | Best For | Limitation |
|---|---|---|
| **Link table** | Facts with different measures/granularity | Extra table in model |
| **Concatenated fact** | Facts with same structure (actual vs budget) | Must pad missing fields with 0/null |

### Concatenated Fact (Alternative)
```qlik
FactFinancial:
LOAD %ProductKey, %DateKey, %RegionKey,
     SalesAmount, 0 as BudgetAmount, 'Actual' as Source
FROM [lib://QVD/sales.qvd] (qvd);

CONCATENATE(FactFinancial)
LOAD %ProductKey, %DateKey, %RegionKey,
     0 as SalesAmount, BudgetAmount, 'Budget' as Source
FROM [lib://QVD/budget.qvd] (qvd);

// Expressions:
// Sum({<Source={'Actual'}>} SalesAmount)
// Sum({<Source={'Budget'}>} BudgetAmount)
```

## Tips

1. **Composite key delimiter** — Use `|` or `¤` (not `,` which may appear in data)
2. **DISTINCT is critical** — The link table must have unique key combinations
3. **Don't put measures in the link table** — It only holds keys
4. **Check row counts** — LinkTable rows should equal the DISTINCT count of key combinations across all facts
5. **Consider Autonumber** — For large link tables, `Autonumber(%LinkKey)` saves memory
