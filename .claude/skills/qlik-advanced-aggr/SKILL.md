---
name: qlik-advanced-aggr
description: >
  Advanced aggregation patterns using the AGGR() function. Covers nested
  aggregations (e.g., Average of Sums), dimensional scope, Top N dynamic
  filtering, NODISTINCT, and performance implications. Use when calculating
  metrics that require a virtual table or calculating over a different level
  of granularity than the chart dimensions.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-expressions
---

# Advanced AGGR() Patterns

## When to Use

- User needs an "Average of a Sum" or "Max of a Count"
- User wants to find the "Top N" items dynamically in an expression
- User needs to calculate a metric at a different granularity than the chart displays
- User asks about `Aggr()`, `NODISTINCT`, or "virtual tables"

## Understanding AGGR()

The `Aggr()` function creates a virtual table in memory during chart calculation. It groups a measure by one or more dimensions, and then returns an array of values that can be further aggregated.

### Syntax
```qlik
Aggr([NODISTINCT] Expression, Dimension1, [Dimension2, ...])
```

## Pattern 1: Aggregation of an Aggregation

The most common use case. How do you find the average sales per customer?

```qlik
// 1. Calculate Sum(Sales) for each Customer (Virtual Table)
// 2. Wrap that in an Avg() to get the average across all customers

Avg( Aggr( Sum(Sales), Customer ) )
```

**Max Sales Day:**
```qlik
// What was the highest total sales amount on any single day?
Max( Aggr( Sum(Sales), OrderDate ) )
```

## Pattern 2: Top N Dynamic Filtering

How do you calculate the total sales, but only for the Top 10 customers? (Without using the UI dimension limits).

Use the `Rank()` function inside an `Aggr()`.

```qlik
Sum(
  If(
    Aggr( Rank( Sum(Sales) ), Customer ) <= 10, // If the customer is in the top 10
    Sales                                       // Then include their sales
  )
)
```

## Pattern 3: Cohort Analysis (Binning)

Group customers dynamically based on their total sales.

1. **Create a calculated dimension in the chart:**
```qlik
// Create 3 buckets based on the customer's total sales
If( Aggr(Sum(Sales), Customer) > 10000, 'High Value',
  If( Aggr(Sum(Sales), Customer) > 5000, 'Medium Value', 'Low Value' )
)
```
2. **Measure:** `Count(DISTINCT Customer)`

## Pattern 4: The NODISTINCT Qualifier

By default, `Aggr()` returns one row per distinct dimensional combination. If multiple customers have the exact same `Sum(Sales)`, a standard `Aggr` might only return that value once to the outer aggregation function, causing incorrect averages or sums.

**Always use `NODISTINCT` when the outer aggregation is `Sum()`, `Avg()`, or `Count()` over the virtual table.**

```qlik
// Correct pattern for Average of Sums
Avg( Aggr( NODISTINCT Sum(Sales), Customer ) )
```

## Pattern 5: Keeping Dimensional Scope

When using `Aggr()` inside a chart that already has dimensions, the virtual table does not automatically "know" about the chart's dimensions unless you explicitly include them.

**Scenario:** A bar chart showing `Region`. You want the Max daily sales per region.

```qlik
// ❌ WRONG: This calculates the Max Daily Sales globally, and returns the same number for every Region.
Max( Aggr( Sum(Sales), OrderDate ) )

// ✅ CORRECT: Include the chart's dimension in the Aggr scope so the virtual table is split by Region.
Max( Aggr( Sum(Sales), Region, OrderDate ) )
```

## Performance Warning

`Aggr()` creates a temporary table in RAM every time the user clicks a filter.
- **Do not use `Aggr()` over millions of distinct values** (e.g., `Aggr(Sum(Sales), TransactionID)`). It will crash the engine.
- If the calculation is static, move it to the Load Script using a `GROUP BY` clause.

[See references/aggr-alternatives.md for script-based alternatives]
[See assets/aggr-templates.txt for copy-paste expression snippets]
