# KPI Expression Library

## Sales & Revenue

### Total Revenue
```qlik
Sum(Sales)
```

### Revenue Growth (YoY)
```qlik
(Sum({<Year={$(=Max(Year))}>} Sales) - Sum({<Year={$(=Max(Year)-1)}>} Sales))
/ Sum({<Year={$(=Max(Year)-1)}>} Sales)
```

### Average Order Value (AOV)
```qlik
Sum(Sales) / Count(DISTINCT OrderID)
```

### Revenue per Customer
```qlik
Sum(Sales) / Count(DISTINCT CustomerID)
```

### Gross Margin %
```qlik
(Sum(Sales) - Sum(Cost)) / Sum(Sales)
```

### Net Profit Margin
```qlik
Sum(Profit) / Sum(Sales)
```

---

## Customer Metrics

### Customer Count
```qlik
Count(DISTINCT CustomerID)
```

### New Customers (This Year)
```qlik
Count(DISTINCT {<Year={$(=Max(Year))}>} CustomerID)
- Count(DISTINCT {<Year={$(=Max(Year)-1)}>} CustomerID)
```

### Customer Retention Rate
```qlik
Count(DISTINCT {<Year={$(=Max(Year))}>}
    {<CustomerID=P({<Year={$(=Max(Year)-1)}>} CustomerID)>}
    CustomerID)
/ Count(DISTINCT {<Year={$(=Max(Year)-1)}>} CustomerID)
```

### Average Customer Lifetime Value
```qlik
Avg(Aggr(Sum(Sales), CustomerID))
```

### Customer Concentration (Top 10%)
```qlik
Sum({<CustomerID={"=Rank(Sum(Sales))<=Ceil(Count(DISTINCT TOTAL CustomerID)*0.1)"}>} Sales)
/ Sum(Sales)
```

---

## Inventory & Supply Chain

### Inventory Turnover
```qlik
Sum(CostOfGoodsSold) / Avg(Aggr(Sum(InventoryValue), YearMonth))
```

### Days of Inventory
```qlik
365 / (Sum(CostOfGoodsSold) / Avg(Aggr(Sum(InventoryValue), YearMonth)))
```

### Stockout Rate
```qlik
Count({<StockLevel={0}>} DISTINCT ProductID) / Count(DISTINCT ProductID)
```

### Fill Rate
```qlik
Sum(QuantityShipped) / Sum(QuantityOrdered)
```

### Days Sales Outstanding (DSO)
```qlik
(Sum(AccountsReceivable) / Sum(Sales)) * 365
```

---

## Operations

### Conversion Rate
```qlik
Count({<Status={'Completed'}>} OrderID) / Count(OrderID)
```

### Average Lead Time (Days)
```qlik
Avg(ShipDate - OrderDate)
```

### On-Time Delivery %
```qlik
Count({<DeliveredOnTime={1}>} OrderID) / Count(OrderID)
```

### Return Rate
```qlik
Count({<ReturnFlag={1}>} OrderID) / Count(OrderID)
```

### Defect Rate (PPM)
```qlik
Count({<IsDefect={1}>} UnitID) / Count(UnitID) * 1000000
```

---

## Comparative Periods

### YTD (Year-to-Date)
```qlik
Sum({<IsYTD={1}>} Sales)
```

### Prior YTD
```qlik
Sum({<IsYTD={1}, Year={$(=Year(Today())-1)}>} Sales)
// Or with flag: Sum({<IsPrevYTD={1}>} Sales)
```

### YTD Growth %
```qlik
(Sum({<IsYTD={1}>} Sales) - Sum({<IsPrevYTD={1}>} Sales))
/ Sum({<IsPrevYTD={1}>} Sales)
```

### MTD (Month-to-Date)
```qlik
Sum({<IsMTD={1}>} Sales)
```

### Rolling 12 Months
```qlik
Sum({<IsLast12Months={1}>} Sales)
```

### Same Month Last Year
```qlik
Sum({<Year={$(=Year(Today())-1)}, MonthNum={$(=Month(Today()))}>} Sales)
```

---

## Formatting Patterns

### Currency
```qlik
Num(Sum(Sales), '$#,##0')
Num(Sum(Sales), '$#,##0.00')
```

### Large Numbers
```qlik
If(Sum(Sales) >= 1000000,
    Num(Sum(Sales)/1000000, '#,##0.0') & 'M',
    If(Sum(Sales) >= 1000,
        Num(Sum(Sales)/1000, '#,##0.0') & 'K',
        Num(Sum(Sales), '#,##0')))
```

### Percentage
```qlik
Num(Sum(Sales)/Sum(TOTAL Sales), '0.0%')
```

### Trend Arrow
```qlik
If(Sum(Sales) > Sum({<Year={$(=Max(Year)-1)}>} Sales), '▲', '▼')
& ' ' & Num(Sum(Sales), '#,##0')
```

### Conditional Color Tag (for text objects)
```qlik
='<span style="color:' &
If(Sum(Sales) >= Sum(Target), 'green', 'red') &
'">' & Num(Sum(Sales), '#,##0') & '</span>'
```
