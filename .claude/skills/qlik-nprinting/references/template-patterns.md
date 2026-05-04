# NPrinting Template Design Patterns

## Excel Template Patterns

### Basic Data Export
```
Row 1 (Header): CustomerID | CustomerName | Region | Sales | Orders
Row 2 (Tags):   <CustomerID> | <CustomerName> | <Region> | <Sum(Sales)> | <Count(OrderID)>
```
NPrinting expands Row 2 for each data row automatically.

### Grouped Report with Subtotals
```
Level: Region
  Row: <Region> (Group Header)
  Table:
    <CustomerName> | <Sum(Sales)> | <Avg(Sales)>
  Subtotal: =SUBTOTAL(9, D:D)    ← Native Excel formula
```

### Multi-Sheet (One Per Region)
```
Page: Region
  Sheet name: <Region>
  Content: Full report for that region
```
Creates: Sheet "North", Sheet "South", Sheet "East", Sheet "West"

### Dashboard Sheet + Detail Sheets
```
Sheet 1: "Summary"
  [Chart: Sales by Region]    ← Chart image
  [KPI: Total Revenue]        ← Single value
  
Sheet 2+: Pages by Region
  [Table: Customer Detail for <Region>]
```

## Word Template Patterns

### Executive Summary
```
QUARTERLY BUSINESS REVIEW — Q<Quarter> <Year>

Revenue: $<Sum(Sales)>
Growth: <Growth%>
Top Region: <FirstSortedValue(Region, -Sum(Sales))>

[Chart: Revenue Trend]

Key Highlights:
• <Region> contributed <Sum(Sales)> (<Pct>% of total)
  Level: Top 3 Regions
```

### Customer Letter (Bursted)
```
Page: CustomerID

Dear <CustomerName>,

Thank you for your business in <Year>. Your account summary:

Total Purchases: $<Sum(Sales)>
Orders Placed: <Count(DISTINCT OrderID)>
Average Order: $<Avg(OrderValue)>

[Table: Recent Orders]

Best regards,
Account Management Team
```

## PowerPoint Patterns

### KPI Dashboard Slide
```
Slide 1: Title
  "Monthly Performance Report — <MonthName> <Year>"

Slide 2: KPI Overview
  [Revenue KPI]  [Margin KPI]  [Customer Count KPI]

Slide 3: Charts
  [Bar: Sales by Region]  [Line: Sales Trend]

Slide 4: Details
  [Table: Top 10 Customers]
```

### Regional Slide Deck (Bursted)
```
Page: Region

Slide 1: "<Region> Performance"
Slide 2: [Charts specific to <Region>]
Slide 3: [Customer table for <Region>]
```

## PixelPerfect Patterns

### Invoice Layout
```
┌─────────────────────────────────────┐
│ COMPANY LOGO          Invoice #<ID> │  ← Page Header
│                       Date: <Date>  │
├─────────────────────────────────────┤
│ Bill To: <CustomerName>             │  ← Group Header (per Invoice)
│          <Address>                  │
├──────┬──────────┬────────┬──────────┤
│ Qty  │ Product  │ Price  │ Total    │  ← Detail Band (per line item)
│ <Qty>│ <Product>│ <Price>│ <Total>  │
├──────┴──────────┴────────┴──────────┤
│              Subtotal: $<Subtotal>  │  ← Group Footer
│              Tax:      $<Tax>       │
│              TOTAL:    $<GrandTotal>│
├─────────────────────────────────────┤
│ Thank you for your business!        │  ← Page Footer
│ Page <PageNumber> of <TotalPages>   │
└─────────────────────────────────────┘
```

### Shipping Label
```
┌───────────────────────┐
│ FROM:                 │
│ Warehouse A           │
│ 123 Main St           │
├───────────────────────┤
│ TO:                   │
│ <CustomerName>        │
│ <Address>             │
│ <City>, <State> <Zip> │
├───────────────────────┤
│ [Barcode: <OrderID>]  │
│ Ship Date: <ShipDate> │
│ Weight: <Weight> lbs  │
└───────────────────────┘
```

## Performance Tips for Templates

1. **Limit chart images** — Each chart is rendered as an image; more charts = slower
2. **Use tables over individual cells** — Tables expand efficiently; scattered cells don't
3. **Filter data in the Qlik app** — Don't load 1M rows and filter in NPrinting
4. **Keep page/level count reasonable** — 1000 pages = 1000 separate renders
5. **Use straight tables over pivot tables** — Pivots are slower to render
6. **Pre-aggregate in the Qlik script** — Don't rely on NPrinting to calculate
