---
name: qlik-odag-dynamic-views
description: >
  Implement On-Demand App Generation (ODAG) and Dynamic Views for handling
  massive datasets in Qlik Sense. Covers Selection App design, Template App
  bindings, ODAG navigation links, Dynamic View chart integration, and
  best practices for passing selections to SQL queries. Use when a dataset
  is too large to load entirely into memory.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-optimization
---

# Qlik ODAG & Dynamic Views

## When to Use

- User has "Big Data" (billions of rows) that exceeds Qlik memory limits
- User wants to filter data *before* loading it into Qlik
- User asks about "On-Demand App Generation" or "ODAG"
- User mentions "Dynamic Views" or querying live databases
- User needs a "Selection App" and a "Detail App"

## ODAG vs Dynamic Views

Both patterns solve the "Big Data" problem by keeping granular data in the database and only loading a sliced subset into Qlik memory.

| Feature | Concept | User Experience |
|---|---|---|
| **ODAG** | Generates a *brand new app* based on user selections. | User makes selections → clicks a button → opens a new browser tab with the generated detail app. |
| **Dynamic Views** | Refreshes *individual charts* within the current app. | User makes selections → clicks "Refresh" on a chart → the chart updates in place. |

---

## ODAG (On-Demand App Generation)

ODAG requires two apps:
1. **Selection App**: Contains aggregated data (e.g., Year, Month, Region, total counts). Used to filter the data down to a manageable size.
2. **Template App**: Contains the detailed data model. This app is cloned and injected with the user's selections from the Selection App.

### Step 1: Create the Selection App

The Selection App must track how many detailed records the user's current selections represent.

```qlik
// Selection App Script
// Load aggregated data, NOT transaction-level detail
SalesSummary:
LOAD
    YearMonth,
    Region,
    CustomerID,
    Count(OrderID) as OrderCount,   // Used to track volume
    Sum(Amount) as TotalSales
FROM [lib://Data/aggregated_sales.qvd] (qvd);
```

**UI Setup:**
- Add a KPI or Gauge showing `=Sum(OrderCount)`.
- Set a threshold (e.g., 50,000 rows). Users must filter below this threshold before generating the app.

### Step 2: Create the Template App

The Template App uses **ODAG Bindings** in the script to accept selections from the Selection App.

**Binding Syntax:** `$(odag_XXX)`

```qlik
// Template App Script
// Default variables (used if running manually for testing)
SET odag_CustomerID = '';
SET odag_YearMonth = '';

// Subroutine to construct the SQL WHERE clause from ODAG selections
SUB BuildOdagWhere
    LET vWhere = '1=1';
    
    // Check if CustomerID was passed
    IF Len('$(odag_CustomerID)') > 0 THEN
        // odag bindings format values like: 'CustA','CustB'
        LET vWhere = vWhere & ' AND CustomerID IN (' & '$(odag_CustomerID)' & ')';
    END IF
    
    IF Len('$(odag_YearMonth)') > 0 THEN
        LET vWhere = vWhere & ' AND YearMonth IN (' & '$(odag_YearMonth)' & ')';
    END IF
END SUB

CALL BuildOdagWhere;

// Load the detailed data using the dynamic WHERE clause
DetailedOrders:
SQL SELECT
    OrderID,
    CustomerID,
    ProductID,
    OrderDate,
    Amount,
    Quantity
FROM database.schema.orders
WHERE $(vWhere);
```

### Step 3: Link the Apps

1. In the **Selection App**, edit the sheet.
2. Go to **App navigation links** (left panel).
3. Create a new link:
   - **Target app**: Select the Template App.
   - **Row estimate expression**: `=Sum(OrderCount)`
   - **Row limit**: e.g., 50000. (The button will be disabled until the estimate is below this limit).
4. Drag the navigation link onto the sheet.

---

## Dynamic Views

Dynamic Views allow you to embed charts from a Template App directly into a Base App. When the user filters the Base App, the embedded charts can be refreshed on-demand, querying the database live.

### Step 1: Create the Template App (for Dynamic Views)

The script pattern is exactly the same as ODAG. Use `$(odag_XXX)` bindings to receive selections and filter the SQL query.

1. Build the Template App script with ODAG bindings.
2. Build the charts (e.g., a granular scatter plot of individual transactions).
3. **Make the charts Master Items.** (Dynamic views can only embed Master Visualizations).

### Step 2: Create the Base App

1. In the Base App, go to the **Dynamic Views** panel (left side, bottom icon).
2. Create a new Dynamic View.
   - **Template app**: Select the Template App you built.
   - **Row expression**: `=Sum(OrderCount)`
   - **Row limit**: e.g., 10000.
3. Drag the Dynamic View charts onto your sheet.

### User Experience
- The dynamic charts appear with a "Stale" or "Needs Refresh" icon.
- When the user filters the Base App below the row limit, the "Refresh" button becomes active.
- Clicking refresh triggers a micro-reload of the Template App in the background, passing the selections, querying the database, and updating the chart in place.

---

## Handling Different Data Types in Bindings

ODAG bindings format the selected values based on the field type. Be careful when passing strings vs numbers to SQL databases.

### 1. Default Binding (String List)
`$(odag_Region)`
Outputs: `'North','South','East'`
Usage: `WHERE Region IN ($(odag_Region))`

### 2. Numeric Binding (No Quotes)
For integer fields, you often need to remove the quotes for the database.
You must use the `odag_value` specific binding notation:
`$(odag_active(odag_numeric_value, OrderID))`
Outputs: `1001,1002,1003`

### 3. Handling "All" Selections (No Selection Made)

If the user makes no selection on a field, the ODAG binding is empty.

```qlik
// Safe SQL construction pattern
LET vRegionFilter = '1=1'; // Default: return everything

IF Len('$(odag_Region)') > 0 THEN
    LET vRegionFilter = 'Region IN (' & '$(odag_Region)' & ')';
END IF

SQL SELECT * FROM Sales WHERE $(vRegionFilter);
```

## ODAG Binding Suffixes (Advanced)

Qlik provides several suffixes to control how the selected values are formatted.

| Binding | Output Example | Use Case |
|---|---|---|
| `$(odag_Field)` | `'A','B'` | Standard SQL IN clause (strings) |
| `$(odag_Field_1)` | `'A'` | Only the first selected value |
| `$(odag_Field_count)` | `2` | Number of selected values |
| `$(odag_active(odag_numeric_value, Field))` | `1,2` | Standard SQL IN clause (numbers) |

[See references/odag-sql-patterns.md for advanced dynamic SQL generation]
[See assets/odag-template.qlik for a complete template app script]
