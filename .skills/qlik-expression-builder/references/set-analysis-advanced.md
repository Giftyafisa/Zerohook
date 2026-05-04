# Advanced Set Analysis Patterns

## Indirect Set Analysis (P() and E())

### P() — Possible Values
Returns values possible given current selections:

```qlik
// Sales for customers who bought Electronics
Sum({<CustomerID=P({<ProductCategory={'Electronics'}>} CustomerID)>} Sales)
```

### E() — Excluded Values
Returns values excluded by current selections:

```qlik
// Sales for products NOT in the current selection
Sum({<ProductID=E(ProductID)>} Sales)
```

## Cross-Field Set Analysis

```qlik
// Sales for customers who ordered in 2024
Sum({<CustomerID=P({<Year={2024}>} CustomerID)>} Sales)

// Revenue from VIP customers only
Sum({<CustomerID=P({<Segment={'VIP'}>} CustomerID)>} Sales)

// Products bought by North region customers in 2024
Sum({<ProductID=P({<CustomerID=P({<Region={'North'}, Year={2024}>} CustomerID)>} ProductID)>} Sales)
```

## Set Analysis with Flags

Pre-computed flags make expressions faster:

```qlik
// Instead of complex date math in set analysis:
Sum({<IsYTD={1}>} Sales)
Sum({<IsYTD={1}, Year={$(=Year(Today())-1)}>} Sales)
Sum({<IsMTD={1}>} Sales)
Sum({<IsLast30Days={1}>} Sales)
Sum({<IsLast12Months={1}>} Sales)
```

## Dynamic Set Analysis with Variables

```qlik
// Reusable set modifiers
SET vCY = {<Year={$(=Max(Year))}>};
SET vPY = {<Year={$(=Max(Year)-1)}>};

// Usage
Sum($(vCY) Sales)
Sum($(vPY) Sales)

// Growth rate
Sum($(vCY) Sales) / Sum($(vPY) Sales) - 1
```

## Ignoring Specific Selections

```qlik
// Ignore Region selection
Sum({<Region=>} Sales)

// Ignore Region AND Product selections
Sum({<Region=, Product=>} Sales)

// Keep only Year selection, ignore everything else
Sum({1<Year=$::Year>} Sales)
```

## Combining Set Operators

```qlik
// Union: current selection OR specific value
Sum({$+1<Region={'North'}>} Sales)

// Intersection: current selection AND specific value
Sum({$*1<Year={2024}>} Sales)

// Exclusion: everything except current selection
Sum({1-$} Sales)
```

## Search Strings

```qlik
// Wildcard
Sum({<ProductName={"*Pro*"}>} Sales)

// Numeric ranges
Sum({<Price={">100<500"}>} Sales)
Sum({<Quantity={">10"}>} Sales)
Sum({<Discount={">=0.1<=0.5"}>} Sales)

// Multiple search strings
Sum({<ProductName={"*Widget*","*Gadget*"}>} Sales)
```

## Common Advanced Patterns

### Percentage of Parent
```qlik
// % of region total (in a chart with Region + Product dimensions)
Sum(Sales) / Sum(TOTAL <Region> Sales)
```

### Benchmark Comparison
```qlik
// Current vs same period last year
Sum(Sales) - Sum({<Year={$(=Max(Year)-1)}>} Sales)
```

### Moving Average in Set Analysis
```qlik
// 3-month moving average
(Sum({<YearMonth={$(=Date(AddMonths(MonthStart(Today()),0),'YYYY-MM'))}>} Sales)
+ Sum({<YearMonth={$(=Date(AddMonths(MonthStart(Today()),-1),'YYYY-MM'))}>} Sales)
+ Sum({<YearMonth={$(=Date(AddMonths(MonthStart(Today()),-2),'YYYY-MM'))}>} Sales))
/ 3
```

### Market Share
```qlik
// Selected product's share of total market
Sum(Sales) / Sum({<ProductName=>} Sales)
```
