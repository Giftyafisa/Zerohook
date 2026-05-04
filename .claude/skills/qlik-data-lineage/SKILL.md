---
name: qlik-data-lineage
description: >
  Track and document data lineage across Qlik apps — from source systems
  through QVD layers to presentation fields and chart expressions. Covers
  field-level lineage, impact analysis, script-based lineage extraction,
  Qlik Cloud Data Catalog, and documentation patterns. Use when tracing
  where data comes from, what transforms it, and what depends on it.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-governance
---

# Qlik Data Lineage

## When to Use

- User asks "Where does this field come from?"
- User needs to understand the data flow from source to dashboard
- User wants to do impact analysis ("If I change this, what breaks?")
- User mentions data catalog, lineage, or field tracing
- User needs to document their data pipeline
- AI has MCP access to `get_script`, `get_tables_and_keys`, `get_available_fields`

## MCP-Assisted Lineage Analysis

When connected to a Qlik app via MCP, the AI can trace lineage automatically:

### Workflow
```
1. get_script(appId)           → Read the full load script
2. get_tables_and_keys(appId)  → See table structure and key relationships
3. get_available_fields(appId) → See all fields with source tables and tags
4. Parse the script to trace:
   - Which source (file/DB) produces which raw fields
   - Which transformations (ApplyMap, If, calculations) create derived fields
   - Which QVDs are read/written
   - Which fields are key fields linking tables
```

## Lineage Levels

### Level 1: Source → QVD → App
```
SQL Server.dbo.Customers  →  customers_raw.qvd  →  dim_customers.qvd  →  Sales Dashboard
                                                                            ↓
                                                                    CustomerName field
                                                                    in "Sales by Customer" chart
```

### Level 2: Field-Level Lineage
```
Source: dbo.Customers.first_name + dbo.Customers.last_name
  ↓ (ETL_Extract)
Raw QVD: customers_raw.qvd [first_name, last_name]
  ↓ (ETL_Transform)
Transform: first_name & ' ' & last_name → CustomerName
  ↓ (stored in QVD)
Transformed QVD: dim_customers.qvd [CustomerName]
  ↓ (loaded by presentation app)
App field: CustomerName
  ↓ (used in)
Master Dimension: "Customer Name"
Chart: "Top 10 Customers by Revenue"
```

### Level 3: Expression Lineage
```
Chart Expression: Sum({<IsYTD={1}>} Revenue)
  ↓
Fields used:
  - IsYTD → Master Calendar (calculated: Year=CurrentYear AND Month<=CurrentMonth)
  - Revenue → fact_orders.qvd (calculated: Amount * (1-Discount))
    - Amount → orders_raw.qvd → SQL Server dbo.Orders.Amount
    - Discount → orders_raw.qvd → SQL Server dbo.Orders.Discount
```

## Script-Based Lineage Extraction

### Parsing Load Statements

Extract lineage information from the script:

```qlik
// This load statement:
Dim_Customers:
LOAD
    CustomerID as %CustomerKey,
    Upper(Trim(CustomerName)) as CustomerName,
    If(IsNull(Region), 'Unknown', Region) as Region
FROM [lib://QVD_Raw/customers_raw.qvd] (qvd);

// Tells us:
// Source: lib://QVD_Raw/customers_raw.qvd
// Target table: Dim_Customers
// Field lineage:
//   %CustomerKey ← CustomerID (rename)
//   CustomerName ← CustomerName (with Upper+Trim transform)
//   Region ← Region (with null replacement)
```

### Tracking QVD Flow

```qlik
// STORE tells us what QVDs an app produces:
STORE Dim_Customers INTO [lib://QVD_Transform/dim_customers.qvd] (qvd);

// FROM tells us what QVDs an app consumes:
LOAD * FROM [lib://QVD_Transform/dim_customers.qvd] (qvd);
```

### Automated Lineage Documentation Script

Add to your ETL apps to generate lineage metadata:

```qlik
///$tab Lineage-Metadata
// Generate lineage documentation at end of reload

_Lineage:
LOAD * INLINE [
    AppName, Layer, SourcePath, TargetTable, TargetQvd, FieldCount, RowCount, ReloadTime
];

// For each table, document its lineage
LET vTableCount = NoOfTables();
FOR vT = 0 TO vTableCount - 1
    LET vTName = TableName(vT);
    
    // Skip internal/temp tables
    IF NOT WildMatch('$(vTName)', '_*', '$*', 'Lineage*') THEN
        LET vTRows = NoOfRows('$(vTName)');
        LET vTFields = NoOfFields('$(vTName)');
        
        CONCATENATE(_Lineage)
        LOAD
            'ETL_Transform' as AppName,
            'Transform' as Layer,
            'lib://QVD_Raw/' as SourcePath,
            '$(vTName)' as TargetTable,
            'lib://QVD_Transform/$(vTName).qvd' as TargetQvd,
            $(vTFields) as FieldCount,
            $(vTRows) as RowCount,
            Timestamp(Now()) as ReloadTime
        AUTOGENERATE 1;
    END IF
NEXT vT

STORE _Lineage INTO [lib://QVD_Meta/lineage_transform.qvd] (qvd);
DROP TABLE _Lineage;
```

## Impact Analysis

### "What happens if I change field X?"

To determine impact of changing a field:

1. **Find all QVDs containing the field**
   ```
   Search: Which QVDs contain "CustomerName"?
   → customers_raw.qvd, dim_customers.qvd
   ```

2. **Find all apps loading those QVDs**
   ```
   Search: Which apps load dim_customers.qvd?
   → Sales Dashboard, Finance Report, Executive Summary
   ```

3. **Find all expressions using the field**
   ```
   Search: Which master items/charts use "CustomerName"?
   → Master Dimension "Customer", chart "Top Customers", filter "Customer Filter"
   ```

### Impact Analysis via MCP

```
For each app in the environment:
  1. get_script(appId) → Search for field name in LOAD statements
  2. get_available_fields(appId) → Check if field exists in data model
  3. Check master items → Is the field used in measures/dimensions?
```

### Impact Documentation Pattern

```qlik
// Create an impact map in a dedicated app
ImpactMap:
LOAD * INLINE [
    FieldName, SourceTable, UsedInApp, UsedInChart, UsedInMasterItem
    CustomerName, dim_customers.qvd, Sales Dashboard, Top 10 Customers, Master Dim: Customer
    CustomerName, dim_customers.qvd, Finance Report, Customer Revenue, Master Dim: Customer
    Revenue, fact_orders.qvd, Sales Dashboard, Revenue KPI, Master Measure: Revenue
    Revenue, fact_orders.qvd, Executive Summary, Monthly Trend, Master Measure: Revenue
];
```

## Qlik Cloud Data Catalog

Qlik Cloud includes a built-in data catalog:

### Features
- **Automatic profiling** — Field-level statistics, data types, patterns
- **Lineage visualization** — Visual data flow diagram
- **Search** — Find datasets, fields, apps by name
- **Tags and descriptions** — Add metadata to fields and tables
- **Impact analysis** — See downstream dependencies

### Accessing
- **Hub → Catalog** or **Management Console → Data catalog**
- Each dataset shows: source, profiling stats, related apps, lineage

### Enriching the Catalog

Add descriptions to fields in the load script:

```qlik
// Use COMMENT FIELD to add descriptions
COMMENT FIELD %CustomerKey WITH 'Surrogate key linking to Dim_Customers';
COMMENT FIELD Revenue WITH 'Net revenue after discounts (Amount * (1 - Discount))';
COMMENT FIELD IsYTD WITH 'Flag: 1 if date is in current year-to-date, 0 otherwise';

// Use COMMENT TABLE to add table descriptions
COMMENT TABLE Dim_Customers WITH 'Customer dimension from CRM system. Updated daily.';
COMMENT TABLE Fact_Orders WITH 'Order transactions. Grain: one row per order line item.';
```

### TAG for Classification

```qlik
// Tag fields for categorization
TAG FIELD Revenue WITH '$monetary', '$measure';
TAG FIELD CustomerName WITH '$dimension', '$text';
TAG FIELD OrderDate WITH '$date', '$timestamp';
TAG FIELD %CustomerKey WITH '$key', '$hidden';
```

Standard Qlik tags:
- `$dimension` — Dimension field
- `$measure` — Measure field
- `$date` / `$timestamp` — Date/time fields
- `$key` — Key field
- `$hidden` — Hide from Insight Advisor
- `$text` — Text field
- `$monetary` — Currency field
- `$geoname` / `$geopoint` — Geographic fields

## Documentation Patterns

### Data Dictionary QVD

```qlik
// Maintain a data dictionary as a QVD
DataDictionary:
LOAD * INLINE [
    FieldName, DataType, Source, Description, BusinessOwner, LastUpdated
    %CustomerKey, Integer, CRM.dbo.Customers, Surrogate key for customer dimension, Data Team, 2024-01-15
    CustomerName, String, CRM.dbo.Customers, Full customer name (First + Last), Data Team, 2024-01-15
    Revenue, Decimal, ERP.dbo.OrderLines, Net revenue (Amount * (1 - Discount)), Finance, 2024-01-15
    IsYTD, Integer, Calculated, Year-to-date flag (1/0), Data Team, 2024-01-15
];

STORE DataDictionary INTO [lib://QVD_Meta/data_dictionary.qvd] (qvd);
```

### Lineage Visualization App

Build a dedicated Qlik app that visualizes the data flow:

```qlik
// Node table (apps and QVDs)
Nodes:
LOAD * INLINE [
    NodeID, NodeName, NodeType, Layer
    1, SQL Server CRM, Source, 0-Source
    2, ETL_Extract_CRM, App, 1-Extract
    3, customers_raw.qvd, QVD, 1-Extract
    4, ETL_Transform, App, 2-Transform
    5, dim_customers.qvd, QVD, 2-Transform
    6, Sales Dashboard, App, 3-Present
    7, Finance Report, App, 3-Present
];

// Edge table (data flows)
Edges:
LOAD * INLINE [
    FromNode, ToNode, FlowType
    1, 2, Extract
    2, 3, Store
    3, 4, Load
    4, 5, Store
    5, 6, Load
    5, 7, Load
];
```

## Best Practices

1. **COMMENT all fields** — Add business descriptions in the script
2. **TAG fields** — Classify with standard Qlik tags
3. **Document QVD flows** — Which app produces which QVDs
4. **Maintain a data dictionary** — Central reference for all fields
5. **Use consistent naming** — `%` prefix for keys, `dim_`/`fact_` for tables
6. **Track changes** — Version control your scripts (see qlik-cicd-version-control skill)
7. **Automate lineage extraction** — Add metadata generation to ETL scripts
8. **Review regularly** — Update lineage docs when scripts change

[See references/impact-analysis-guide.md for systematic impact analysis]
[See assets/ for lineage documentation templates]
