# Business Logic Setup Guide

## Step-by-Step Configuration

### 1. Open Business Logic
- Open your app in Qlik Cloud / Qlik Sense
- Navigate to **Business Logic** (in the app navigation bar)
- Select **Logical Model**

### 2. Review Auto-Classification
Qlik auto-classifies some fields. Review and correct:

| Auto-Classification | When It's Wrong |
|---|---|
| Dimension → Measure | Numeric ID fields classified as measures (e.g., ZipCode) |
| Measure → Dimension | Low-cardinality numbers classified as dimensions |
| Missing date | Date fields not recognized (check format) |
| Missing geo | City/Country fields not recognized |

### 3. Field Classification Checklist

For each field, verify:
- [ ] Correct type (dimension, measure, date, geo)
- [ ] Correct default aggregation (Sum, Count, Avg, etc.)
- [ ] Correct visibility (visible, hidden, or always one selected)
- [ ] Assigned to a group

### 4. Group Configuration

Create logical groups:

```yaml
Sales Metrics:
  - Revenue: Sum
  - Quantity: Sum
  - Discount: Avg
  - Profit: Sum

Customer:
  - CustomerName: dimension
  - Segment: dimension
  - Region: dimension

Product:
  - ProductName: dimension
  - Category: dimension
  - SubCategory: dimension

Time:
  - OrderDate: date (auto-calendar)
  - Year: temporal
  - Quarter: temporal
  - Month: temporal
```

### 5. Hierarchy Setup

Define drill-down paths:

```
Geography: Country → Region → State → City
Product:   Category → SubCategory → ProductName
Time:      Year → Quarter → Month → Date
Org:       Department → Team → Employee
```

### 6. Calendar Period Setup

| Period Name | Field | Granularity | Type |
|---|---|---|---|
| Year over Year | OrderDate | Year | Comparison |
| Quarter over Quarter | OrderDate | Quarter | Comparison |
| Month over Month | OrderDate | Month | Comparison |
| YTD | OrderDate | Year | To-date |
| QTD | OrderDate | Quarter | To-date |
| MTD | OrderDate | Month | To-date |
| Last 12 Months | OrderDate | Month | Relative (trailing) |

### 7. Vocabulary

Map business terms to technical expressions:

| Business Term | Maps To |
|---|---|
| revenue, sales, income | Sum(Revenue) |
| profit, earnings | Sum(Revenue) - Sum(Cost) |
| margin, margin% | (Sum(Revenue) - Sum(Cost)) / Sum(Revenue) |
| customers, client count | Count(DISTINCT CustomerID) |
| average order, AOV | Sum(Revenue) / Count(DISTINCT OrderID) |
| growth | Year-over-year comparison |
| top, best | Sorted descending by measure |
| bottom, worst | Sorted ascending by measure |

### 8. Testing

Test with these query patterns:
1. **Simple**: "Show sales by region"
2. **Time**: "Revenue last year vs this year"
3. **Ranking**: "Top 10 customers by revenue"
4. **Filter**: "Sales in North for Electronics"
5. **Trend**: "Monthly sales trend"
6. **Comparison**: "Compare Q1 vs Q2"
7. **Why**: "Why did sales drop?"
8. **Vocabulary**: "What's our margin by segment?"

### 9. Iterate

After testing:
- Add missing vocabulary for failed queries
- Reclassify misidentified fields
- Add more calendar periods if time queries fail
- Hide fields that appear incorrectly in suggestions

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| AI suggests `Sum(CustomerID)` | Classify CustomerID as dimension, not measure |
| "Last year" doesn't work | Add Year-over-Year calendar period |
| Synonym not recognized | Add to vocabulary mapping |
| Too many fields in suggestions | Hide technical/internal fields |
| Wrong chart type | Check field classifications and groups |
| Drill-down not working | Define hierarchy for those fields |
