# Set Analysis Patterns

Set analysis is Qlik's most powerful expression feature — it lets you define a "set" of data independently of the user's current selections.

## Syntax Structure

```
Aggregation({<SetExpression>} Field)
```

- `{ }` — set identifier (curly braces)
- `< >` — set modifier (angle brackets)
- Field assignments inside the modifier filter the data

## Basic Patterns

### Filter to specific values
```qlik
Sum({<Year={2024}>} Sales)
Sum({<Region={'North','South'}>} Sales)
Sum({<Category={'Electronics'}, Year={2024}>} Sales)
```

### Dynamic values (dollar-sign expansion)
```qlik
// Current year
Sum({<Year={$(=Year(Today()))}>} Sales)

// Previous year
Sum({<Year={$(=Year(Today())-1)}>} Sales)

// Current month name
Sum({<Month={$(=Month(Today()))}>} Sales)
```

### Date ranges
```qlik
// Year to date
Sum({<OrderDate={">=$(=Date(YearStart(Today()),'YYYY-MM-DD'))<=$(=Date(Today(),'YYYY-MM-DD'))"}>} Sales)

// Last 30 days
Sum({<OrderDate={">=$(=Date(Today()-30,'YYYY-MM-DD'))"}>} Sales)

// Specific range
Sum({<OrderDate={">=2024-01-01<=2024-06-30"}>} Sales)
```

## Set Identifiers

| Identifier | Meaning |
|---|---|
| `$` | Current selections (default, can omit) |
| `1` | Full dataset, ignore ALL selections |
| `$1` | Previous selection state (back one step) |
| `Bookmark` | Named bookmark state |

```qlik
// Total across all data, ignoring selections
Sum({1} Sales)

// Total ignoring Region selection only
Sum({1<Region=p(Region)>} Sales)
```

## Set Operators

### Ignore a field's selection
```qlik
// Ignore Region selection, keep all others
Sum({<Region=>} Sales)

// Ignore multiple fields
Sum({<Region=, Year=>} Sales)
```

### Exclude specific values
```qlik
// Exclude "Archived" category
Sum({<Category-={'Archived'}>} Sales)

// Exclude multiple
Sum({<Status-={'Cancelled','Returned'}>} Sales)
```

### Force include (override selections)
```qlik
// Always include 2024 regardless of Year selection
Sum({<Year+={2024}>} Sales)
```

## Element Functions

| Function | Returns |
|---|---|
| `P(Field)` | Possible values (associated with current selection) |
| `E(Field)` | Excluded values |

```qlik
// Sales for customers who bought Product A
Sum({<CustomerID=P({<Product={'A'}>} CustomerID)>} Sales)

// Sales for customers who did NOT buy Product A
Sum({<CustomerID=E({<Product={'A'}>} CustomerID)>} Sales)
```

## Combining Sets (Intersection, Union, Exclusion)

```qlik
// Intersection: Must match BOTH conditions
Sum({<Year={2024}> * <Region={'North'}>} Sales)

// Union: Match EITHER condition
Sum({<Year={2024}> + <Region={'North'}>} Sales)

// Exclusion: First set minus second
Sum({<Year={2024}> - <Region={'North'}>} Sales)
```

## Common Business Patterns

### Year-over-Year Comparison
```qlik
// This year
Sum({<Year={$(=Year(Today()))}>} Sales)

// Last year
Sum({<Year={$(=Year(Today())-1)}>} Sales)

// YoY growth %
(Sum({<Year={$(=Year(Today()))}>} Sales) - Sum({<Year={$(=Year(Today())-1)}>} Sales))
/ Sum({<Year={$(=Year(Today())-1)}>} Sales)
```

### Rolling 12 Months
```qlik
Sum({<YearMonth={">=$(=Date(AddMonths(Today(),-12),'YYYY-MM'))<=$(=Date(Today(),'YYYY-MM'))"}>} Sales)
```

### Top N Customers
```qlik
Sum({<CustomerID={"=Aggr(Sum(Sales),CustomerID)>=50000"}>} Sales)
```

### Comparative Selection (Selected vs All)
```qlik
// Selected region's share of total
Sum(Sales) / Sum({1<Region=>} Sales)
```

## Tips

1. **Always format dates** in set analysis as `'YYYY-MM-DD'` to avoid locale issues
2. **Use variables** for repeated set expressions: `SET vCurrentYear = {<Year={$(=Year(Today()))}>};`
3. **Test with simple data** before building complex nested sets
4. **P() and E()** are computed at evaluation time — they respect the current selection context
5. **Avoid deep nesting** — break complex sets into intermediate variables for readability
