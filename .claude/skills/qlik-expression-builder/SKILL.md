---
name: qlik-expression-builder
description: >
  Build advanced Qlik chart expressions with set analysis, aggregation
  functions, conditional logic, ranking, running totals, comparative
  periods, and KPI patterns. Covers expression syntax, performance
  optimization, and common business calculation patterns. Use when
  writing or debugging Qlik chart expressions.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-core
---

# Qlik Expression Builder

## When to Use

- User is writing chart expressions (measures, dimensions, labels)
- User asks about set analysis, aggr(), if(), or aggregation functions
- User needs comparative period calculations (YTD, MTD, vs prior year)
- User mentions KPIs, rankings, running totals, or conditional formatting
- User is debugging an expression that returns unexpected results

## Expression Fundamentals

### Aggregation Functions

All measures in Qlik must be wrapped in an aggregation function:

| Function | Purpose | Example |
|---|---|---|
| `Sum()` | Total | `Sum(Sales)` |
| `Count()` | Count rows | `Count(OrderID)` |
| `Count(DISTINCT)` | Count unique | `Count(DISTINCT CustomerID)` |
| `Avg()` | Average | `Avg(UnitPrice)` |
| `Min()` / `Max()` | Extremes | `Min(OrderDate)` |
| `Only()` | Single value (or null) | `Only(CustomerName)` |
| `Concat()` | Concatenate values | `Concat(ProductName, ', ')` |
| `FirstSortedValue()` | Value of first sorted item | `FirstSortedValue(ProductName, -Sum(Sales))` |

### Basic Expressions

```qlik
// Simple sum
Sum(Sales)

// Calculated measure
Sum(Quantity * UnitPrice)

// Percentage
Sum(Sales) / Sum(TOTAL Sales)

// Count with condition
Count({<Status={'Active'}>} CustomerID)

// Average with null handling
Avg(If(Sales > 0, Sales))
```

## Set Analysis

Set analysis modifies the selection context of an aggregation. It's the most powerful feature of Qlik expressions.

### Syntax
```
Sum( {<SetExpression>} Sales )
     └── Set modifier
```

### Basic Patterns

```qlik
// Fixed value
Sum({<Year={2024}>} Sales)

// Multiple values
Sum({<Year={2023,2024}>} Sales)

// Exclude values
Sum({<Year-={2020}>} Sales)

// Wildcard
Sum({<ProductName={"*Widget*"}>} Sales)

// Variable reference
Sum({<Year={$(vCurrentYear)}>} Sales)

// Current selection + override
Sum({<Year={2024}, Region=>} Sales)
//                  Region=> clears Region selection
```

### Set Operators

| Operator | Meaning | Example |
|---|---|---|
| `$` | Current selection | `{$<Year={2024}>}` |
| `1` | All records (ignore selections) | `{1<Year={2024}>}` |
| `$1` | Bookmark 1 | `{$1}` |
| `*` | Intersection | `{$*<Year={2024}>}` |
| `+` | Union | `{$+1<Year={2024}>}` |
| `-` | Exclusion | `{1-$}` (everything NOT selected) |

### Ignore All Selections
```qlik
// Total sales regardless of any filter
Sum({1} Sales)

// Total for a specific year, ignoring all other filters
Sum({1<Year={2024}>} Sales)
```

### Ignore Specific Selections
```qlik
// Sum of Sales ignoring Region selection
Sum({<Region=>} Sales)

// Ignore multiple fields
Sum({<Region=, Product=>} Sales)
```

### Dollar-Sign Expansion in Set Analysis
```qlik
// Variable containing a year
SET vSelectedYear = 2024;
Sum({<Year={$(vSelectedYear)}>} Sales)

// Dynamic field value from another field
Sum({<Year={$(=Max(Year))}>} Sales)

// Expression inside set
Sum({<Year={"$(=Year(Today()))"}>} Sales)
```

### Search Strings in Set Analysis
```qlik
// Wildcard match
Sum({<ProductName={"*Pro*"}>} Sales)

// Numeric range
Sum({<Price={">100<500"}>} Sales)

// Greater than
Sum({<Quantity={">10"}>} Sales)
```

## Comparative Period Calculations

### Year-Over-Year

```qlik
// Current year sales
Sum({<Year={$(=Max(Year))}>} Sales)

// Prior year sales
Sum({<Year={$(=Max(Year)-1)}>} Sales)

// YoY change
Sum({<Year={$(=Max(Year))}>} Sales) - Sum({<Year={$(=Max(Year)-1)}>} Sales)

// YoY change %
(Sum({<Year={$(=Max(Year))}>} Sales) - Sum({<Year={$(=Max(Year)-1)}>} Sales))
/ Sum({<Year={$(=Max(Year)-1)}>} Sales)
```

### Year-to-Date (YTD)

```qlik
// YTD sales
Sum({<Year={$(=Year(Today()))}, MonthNum={"<=$(=Month(Today()))"}>} Sales)

// Prior YTD (same period last year)
Sum({<Year={$(=Year(Today())-1)}, MonthNum={"<=$(=Month(Today()))"}>} Sales)
```

### Month-to-Date / Quarter-to-Date

```qlik
// MTD
Sum({<YearMonth={$(=Date(MonthStart(Today()),'YYYY-MM'))}, DayOfMonth={"<=$(=Day(Today()))"}>} Sales)

// This quarter
Sum({<YearQuarter={$(=Year(Today()) & '-Q' & Ceil(Month(Today())/3))}>} Sales)
```

### Rolling Periods

```qlik
// Last 12 months
Sum({<YearMonth={"$(=Date(AddMonths(Today(),-12),'YYYY-MM'))">="$(=Date(MonthStart(Today()),'YYYY-MM'))"}>} Sales)

// Last 30 days (if using date flags)
Sum({<IsLast30Days={1}>} Sales)
```

## Conditional Logic

### If() in Expressions

```qlik
// Simple condition
If(Sum(Sales) > 100000, 'High', 'Low')

// Nested conditions
If(Sum(Sales) > 100000, 'High',
   If(Sum(Sales) > 50000, 'Medium', 'Low'))

// Pick (cleaner than nested if)
Pick(
    If(Sum(Sales) > 100000, 1,
       If(Sum(Sales) > 50000, 2, 3)),
    'High', 'Medium', 'Low'
)
```

### Conditional Aggregation

```qlik
// Sum only positive values
Sum(If(Profit > 0, Profit))

// Count with condition
Count(If(Status = 'Active', CustomerID))

// Conditional average
Avg(If(Region = 'North', Sales))
```

### Null Handling

```qlik
// Replace null with 0
If(IsNull(Sum(Sales)), 0, Sum(Sales))

// Alt() — returns first non-null
Alt(Sum(Sales), 0)

// Coalesce-style
Alt(Sum({<Year={2024}>} Sales), Sum({<Year={2023}>} Sales), 0)
```

## AGGR() — Advanced Aggregation

`Aggr()` creates a virtual table for nested aggregation:

```qlik
// Average of customer-level totals
// (average order value per customer, not average of all orders)
Avg(Aggr(Sum(Sales), CustomerID))

// Max monthly sales
Max(Aggr(Sum(Sales), YearMonth))

// Count of customers with sales > $1000
Count(Aggr(If(Sum(Sales) > 1000, CustomerID), CustomerID))

// Top 10 products by sales
Sum({<ProductName={"=Rank(Sum(Sales))<=10"}>} Sales)
```

### AGGR with Multiple Dimensions

```qlik
// Average daily sales per product
Avg(Aggr(Sum(Sales), ProductName, OrderDate))

// Best month for each customer
Aggr(FirstSortedValue(YearMonth, -Sum(Sales)), CustomerID)
```

## Ranking & Top N

### Rank()

```qlik
// Rank by sales (1 = highest)
Rank(Sum(Sales))

// Dense rank (no gaps)
Rank(Sum(Sales), 0, 1)

// Bottom N
Rank(-Sum(Sales))
```

### Top N in Set Analysis

```qlik
// Sales for top 10 products
Sum({<ProductName={"=Rank(Sum(Sales))<=10"}>} Sales)

// Sales excluding top 5
Sum({<ProductName={"=Rank(Sum(Sales))>5"}>} Sales)

// Top N based on a different measure
Sum({<CustomerID={"=Rank(Count(DISTINCT OrderID))<=20"}>} Sales)
```

## Running Totals & Accumulation

```qlik
// Running total (in a chart with a sorted dimension)
RangeSum(Above(Sum(Sales), 0, RowNo()))

// Running average
RangeAvg(Above(Sum(Sales), 0, RowNo()))

// Running count
RangeSum(Above(Count(OrderID), 0, RowNo()))

// Cumulative % (Pareto)
RangeSum(Above(Sum(Sales), 0, RowNo())) / Sum(TOTAL Sales)
```

## TOTAL Qualifier

Forces aggregation across all dimension values:

```qlik
// Percentage of total
Sum(Sales) / Sum(TOTAL Sales)

// Percentage of total within one dimension
Sum(Sales) / Sum(TOTAL <Region> Sales)
//                  ^^^ Only totals across Region

// Deviation from average
Sum(Sales) - Avg(TOTAL Sum(Sales))
```

## String Functions in Expressions

```qlik
// Concatenate with separator
Concat(DISTINCT ProductName, ', ')

// First value sorted by another field
FirstSortedValue(ProductName, -Sum(Sales))

// Text with number formatting
Num(Sum(Sales), '#,##0')
Num(Sum(Sales)/1000000, '#,##0.0M')

// Date formatting
Date(Max(OrderDate), 'DD MMM YYYY')

// Conditional text with color
=If(Sum(Sales) > Sum({<Year={$(=Max(Year)-1)}>} Sales),
    '▲ ' & Num(Sum(Sales), '#,##0'),
    '▼ ' & Num(Sum(Sales), '#,##0'))
```

## Color Expressions

```qlik
// Traffic light
If(Sum(Sales)/Sum(Target) >= 1, RGB(0,128,0),
   If(Sum(Sales)/Sum(Target) >= 0.8, RGB(255,165,0),
      RGB(255,0,0)))

// Gradient (red to green)
ColorMix1(Sum(Sales)/Max(TOTAL Sum(Sales)), RGB(255,0,0), RGB(0,128,0))

// Conditional based on trend
If(Sum(Sales) > Sum({<Year={$(=Max(Year)-1)}>} Sales),
    RGB(46,139,87),   // Green
    RGB(220,20,60))   // Red
```

## Common KPI Patterns

### Conversion Rate
```qlik
Count({<Status={'Completed'}>} OrderID) / Count(OrderID)
```

### Average Order Value
```qlik
Sum(Sales) / Count(DISTINCT OrderID)
```

### Customer Lifetime Value
```qlik
Avg(Aggr(Sum(Sales), CustomerID))
```

### Inventory Turnover
```qlik
Sum(CostOfGoodsSold) / Avg(Aggr(Sum(InventoryValue), YearMonth))
```

### Days Sales Outstanding (DSO)
```qlik
(Sum(AccountsReceivable) / Sum(Sales)) * 365
```

### Gross Margin %
```qlik
(Sum(Sales) - Sum(Cost)) / Sum(Sales)
```

## Expression Performance Tips

1. **Avoid nested `Aggr()`** — Each `Aggr()` creates a virtual table; nesting is exponentially expensive
2. **Pre-calculate in script** — Move complex calculations to the load script where possible
3. **Use flags instead of complex set analysis** — `Sum({<IsYTD={1}>} Sales)` is faster than date range comparisons
4. **Minimize `If()` inside aggregations** — `Count({<Status={'Active'}>} ID)` is faster than `Count(If(Status='Active', ID))`
5. **Use `TOTAL` sparingly** — It recalculates for every cell
6. **Cache expressions in variables** — Reuse common sub-expressions

## Expression Debugging

```qlik
// Check what set analysis returns
Count({<Year={2024}>} OrderID)
// If 0: the field Year doesn't contain '2024' (check type/format)

// Check field values
Concat(DISTINCT Year, ', ')
// Shows all distinct values — verify your expected value exists

// Check if field is numeric or string
If(IsNum(Only(Year)), 'Numeric', 'String')

// Verify selection state
GetCurrentSelections()
```

[See references/set-analysis-advanced.md for complex set analysis patterns]
[See references/kpi-library.md for business KPI formulas]
[See assets/ for ready-to-use expression collections]
