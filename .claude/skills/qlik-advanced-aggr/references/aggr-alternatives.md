# Alternatives to AGGR()

Because `Aggr()` calculates on the fly every time a user makes a selection, it is incredibly resource-intensive for large datasets. Many common `Aggr()` expressions can be moved to the data load script, drastically improving performance.

## 1. Moving "Max Date" Flags to Script

### Slow UI (AGGR)
Finding the most recent order date per customer on the fly:
```qlik
Max({<OrderDate={"=OrderDate=Aggr(Max(OrderDate), CustomerID)"}>} Sales)
```

### Fast Script (GROUP BY)
Pre-calculate the Max Date per customer during reload.

```qlik
// 1. Find Max Date per Customer
_MaxDates:
LOAD 
    CustomerID,
    Max(OrderDate) as MaxOrderDate
RESIDENT Orders
GROUP BY CustomerID;

// 2. Join a Flag back to the main table
LEFT JOIN (Orders)
LOAD
    CustomerID,
    OrderDate,
    1 as IsMaxDateForCustomer
RESIDENT _MaxDates
WHERE OrderDate = MaxOrderDate;

DROP TABLE _MaxDates;
```
**Fast UI Expression:** `Sum({<IsMaxDateForCustomer={1}>} Sales)`

## 2. Moving Cohort Buckets to Script

### Slow UI (AGGR Calculated Dimension)
```qlik
If( Aggr(Sum(Sales), CustomerID) > 10000, 'High Value', 'Low Value' )
```

### Fast Script (GROUP BY)
If the cohort definition does NOT need to respond to UI filters (e.g., Year/Region selections), calculate the lifetime value bucket in the script.

```qlik
_CustomerLTV:
LOAD
    CustomerID,
    Sum(Sales) as LifetimeSales
RESIDENT Orders
GROUP BY CustomerID;

LEFT JOIN (Customers)
LOAD
    CustomerID,
    If(LifetimeSales > 10000, 'High Value', 'Low Value') as CustomerCohort
RESIDENT _CustomerLTV;

DROP TABLE _CustomerLTV;
```
**Fast UI Dimension:** `=CustomerCohort`

## 3. Top N (Rank) Alternatives

If you need a static Top 10 list that doesn't change based on filters, order the data in the script.

```qlik
// Load customers ordered by Sales descending
_TopCustomers:
LOAD 
    CustomerID,
    Sum(Sales) as TotalSales
RESIDENT Orders
GROUP BY CustomerID
ORDER BY TotalSales DESC;

// Assign row numbers (Ranks)
LEFT JOIN (Customers)
LOAD
    CustomerID,
    RowNo() as CustomerRank
RESIDENT _TopCustomers;

DROP TABLE _TopCustomers;
```
**Fast UI Expression:** `Sum({<CustomerRank={"<=10"}>} Sales)`

*(Note: If the Top 10 list must change dynamically when the user selects a Region or Year, you MUST use the `Aggr(Rank())` approach or the Qlik Sense UI dimension limit settings, as script variables are static).*
