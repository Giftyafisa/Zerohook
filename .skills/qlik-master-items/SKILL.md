---
name: qlik-master-items
description: >
  Build governed Qlik apps using Master Items (measures, dimensions,
  visualizations) and variables. Covers naming conventions, centralized
  expression management, dynamic labeling, color consistency, drill-down
  groups, and script-based variable definition. Use when designing
  enterprise dashboards for self-service or self-service analytics.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-core
---

# Qlik Master Items & Governance

## When to Use

- User is building a dashboard for self-service analytics
- User asks how to reuse expressions across multiple charts
- User mentions "Master Items", "Master Measures", or "Master Dimensions"
- User needs consistent colors for specific dimension values
- User wants to manage variables from the load script
- User needs to implement drill-down behavior

## Master Items Overview

Master Items are governed, reusable assets stored in the app. They ensure "one version of the truth" and allow users to build their own charts without knowing the underlying expressions.

| Master Item Type | Purpose | Example |
|---|---|---|
| **Measures** | Reusable calculations | `Sum(Sales)` |
| **Dimensions** | Reusable fields/groups | `Region`, `Year` |
| **Visualizations** | Reusable charts | A fully configured bar chart |
| **Variables** | Dynamic values | `$(vCurrentYear)` |

## Master Measures

### Creating Master Measures
Instead of writing `Sum({<Year={$(=Max(Year))}>} Sales)` in every chart, create a Master Measure called **Current Year Sales**.

1. Edit Sheet → Master Items → Measures → Create New
2. Enter the expression
3. Assign a Name, Description, and Tags
4. Set the **Number formatting** (e.g., Currency)
5. (Optional) Set a consistent color for the measure

### Benefits
- **Update Once, Update Everywhere**: Change the formula in the Master Item, and all charts using it update instantly.
- **Consistent Formatting**: Number formats are locked in.
- **Self-Service**: End users can drag and drop measures without writing code.

### Dynamic Labels
Make Master Measure labels dynamic using expressions:
```qlik
// Label expression:
='Sales (' & Max(Year) & ')'
// Renders as: "Sales (2024)"
```

## Master Dimensions

### Single Dimensions
Create a Master Dimension to rename a field or apply consistent colors.
1. Master Items → Dimensions → Create New → Single
2. Select field (e.g., `ProductCategory`)
3. Set Name and Tags
4. **Value Colors**: Assign specific colors to specific values (e.g., "Electronics" = Blue, "Clothing" = Green). These colors will persist across all charts using this dimension.

### Drill-down Dimensions
A drill-down group allows users to click a chart segment to zoom into the next level of detail.

1. Master Items → Dimensions → Create New → Drill-down
2. Add fields in order of hierarchy (e.g., `Region` → `Country` → `City`)
3. Use in any chart. Clicking a Region bar drills down to Countries in that Region.

## Master Visualizations

Save fully configured charts (with specific dimensions, measures, sorting, and styling) as Master Visualizations.
- Right-click any chart → **Add to master items**
- Users can drag the entire chart onto new sheets.
- *Note:* Master Visualizations are linked. Changing the Master updates all instances. To modify a single instance, right-click and select **Unlink**.

## Variables as a Governance Layer

Variables (`vSales`, `vCurrentYear`) can store expressions, set analysis modifiers, or configuration values.

### Managing Variables in the Load Script

It is best practice to define variables in the load script rather than the UI, so they are version-controlled and centrally managed.

```qlik
// ==========================================
// VARIABLE DEFINITIONS
// ==========================================

// Configuration
SET vEnvironment = 'PROD';
SET vMinRows = 1000;

// Set Analysis Modifiers (note the single quotes)
SET vCY = '<Year={$(=Max(Year))}>';
SET vPY = '<Year={$(=Max(Year)-1)}>';
SET vYTD = '<IsYTD={1}>';

// Expressions (note the LET for evaluation vs SET for string storage)
SET vSales = 'Sum(Sales)';
SET vProfit = 'Sum(Sales) - Sum(Cost)';
```

### Using Variables in Master Measures

Combine Variables and Master Measures for maximum flexibility:

1. Define variable in script: `SET vMetric = 'Sum(Sales)';`
2. Create Master Measure: `$(vMetric)`
3. If you ever need to change the metric definition, you only update the script.

### Variable Parameters (Macros)

Variables can accept parameters (`$1`, `$2`) to act like functions:

```qlik
// Script definition
SET vPeriodSales = 'Sum({<YearMonth={"$(=Date(AddMonths(MonthStart(Today()), $1), 'YYYY-MM'))"}>} Sales)';

// Usage in charts
$(vPeriodSales(0))   // Current month
$(vPeriodSales(-1))  // Prior month
$(vPeriodSales(-12)) // Same month last year
```

## Naming Conventions & Tagging

A chaotic Master Item library defeats the purpose of self-service. Use strict conventions.

### Prefixing
- **Measures**: Prefix with aggregate or domain (e.g., `# Orders`, `$ Sales`, `% Margin`)
- **Dimensions**: Prefix with domain (e.g., `Geo: Region`, `Time: Year`, `Prod: Category`)
- **Variables**: Prefix with `v` (e.g., `vCurrentYear`, `vSetYTD`)

### Tagging
Tags organize the Master Items panel into folders.
- Add tags like `Sales`, `Finance`, `Time`, `Geography`.
- Users can filter by tag to find what they need.

## The "Metrics Table" Pattern

For enterprise apps with hundreds of expressions, define them in a spreadsheet and load them dynamically in the script.

```qlik
// 1. Maintain expressions in an Excel file
// Columns: VariableName | Expression | Description

// 2. Load the file in the script
_Metrics:
LOAD
    VariableName,
    Expression
FROM [lib://Governance/Metrics.xlsx] (ooxml, embedded labels, table is Sheet1);

// 3. Loop through and create variables
FOR vI = 0 TO NoOfRows('_Metrics') - 1
    LET vName = Peek('VariableName', vI, '_Metrics');
    LET vExpr = Peek('Expression', vI, '_Metrics');
    
    // Create the variable dynamically
    LET $(vName) = '$(vExpr)';
NEXT vI

DROP TABLE _Metrics;
```

[See references/variable-governance.md for advanced variable patterns]
[See assets/metrics-loader.qlik for the automated metrics table script]
