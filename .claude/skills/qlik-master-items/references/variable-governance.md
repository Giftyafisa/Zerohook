# Variable Governance Patterns

Variables in Qlik are powerful but can quickly become unmanageable if not structured properly. This guide covers enterprise patterns for variable governance.

## The Difference Between SET and LET

Understanding how Qlik evaluates variables is critical for governance.

### SET (Literal String Storage)
Stores exactly what you type as a string.
```qlik
SET vToday = Today();
// vToday contains the string: "Today()"
// It evaluates to the current date only when used in an expression: $(vToday)
```

### LET (Immediate Evaluation)
Evaluates the expression during the reload script and stores the result.
```qlik
LET vToday = Today();
// vToday contains the string: "11/14/2024" (or whatever the date format is)
// It is static until the next reload.
```

**Best Practice:** Use `SET` for UI expressions (measures, set analysis) so they evaluate dynamically in the charts. Use `LET` for static configuration values (paths, connection strings, current year).

## 1. The Configuration Script Pattern

Store all configuration variables in a single, reusable script file (`config.qvs`) included in every app.

```qlik
// lib://Scripts/config.qvs

// --- Environment ---
SET vEnv = 'PROD';
SET vDataPath = 'lib://PROD_Data';
SET vQvdPath = 'lib://PROD_QVDs';

// --- Formatting ---
SET ThousandSep=',';
SET DecimalSep='.';
SET MoneyThousandSep=',';
SET MoneyDecimalSep='.';
SET MoneyFormat='$#,##0.00;-$#,##0.00';
SET TimeFormat='h:mm:ss TT';
SET DateFormat='M/D/YYYY';
SET TimestampFormat='M/D/YYYY h:mm:ss[.fff] TT';
SET FirstWeekDay=6;
SET BrokenWeeks=1;
SET ReferenceDay=0;
SET FirstMonthOfYear=1;
SET CollationLocale='en-US';
SET CreateSearchIndexOnReload=1;
```

In your app script:
```qlik
$(MUST_INCLUDE=[lib://Scripts/config.qvs]);
```

## 2. Set Analysis Modifiers as Variables

Instead of rewriting complex set analysis in every expression, store the modifiers in variables.

```qlik
// Define modifiers (note the single quotes)
SET vCY = '<Year={$(=Max(Year))}>';
SET vPY = '<Year={$(=Max(Year)-1)}>';
SET vYTD = '<IsYTD={1}>';
SET vPrevYTD = '<IsPrevYTD={1}>';
SET vMTD = '<IsMTD={1}>';

// Combine them in the UI expressions
// Current Year Sales
Sum({$(vCY)} Sales)

// Prior Year YTD Sales
Sum({$(vPY), $(vYTD)} Sales) // Note: combine modifiers with commas
```

**Benefits:**
- If the logic for "YTD" changes, you only update the variable in the script.
- Expressions are much easier to read and debug.

## 3. Parameterized Variables (Macros)

Variables can act like functions by accepting parameters (`$1`, `$2`, etc.).

```qlik
// Define a variable with parameters
// $1 = Metric (e.g., Sales, Cost)
// $2 = Set Modifier (e.g., vCY, vPY)
SET vMetricPeriod = 'Sum({$2} $1)';

// Usage in charts:
$(vMetricPeriod(Sales, $(vCY)))
$(vMetricPeriod(Cost, $(vPY)))
```

Another example: Dynamic Moving Average
```qlik
// $1 = Months back
SET vMovingAvg = '(Sum({<YearMonth={">=$(=Date(AddMonths(Max(YearMonth), -$1), 'YYYY-MM'))<=$(=Max(YearMonth))"}>} Sales) / $1)';

// Usage:
$(vMovingAvg(3)) // 3-month moving average
$(vMovingAvg(6)) // 6-month moving average
```

## 4. UI Toggle Variables

Use variables to control UI state (showing/hiding objects, switching dimensions/measures).

### The "Variable Input" Extension
Use the Qlik Dashboard Bundle's "Variable input" object.

1. Create variable in script: `SET vShowChart = 1;`
2. Create Variable input object linked to `vShowChart`.
3. Display as: Buttons (Values: `1` for "Show", `0` for "Hide").
4. In chart properties → Add-ons → Data handling → Show condition: `vShowChart = 1`

### Dimension/Measure Switching
```qlik
// Script:
SET vDimSelect = 'Region'; // Default
SET vMeasureSelect = 'Sales'; // Default

// UI Variable Input for vDimSelect (Dropdown): 'Region', 'Category', 'Product'
// UI Variable Input for vMeasureSelect (Buttons): 'Sales', 'Profit', 'Margin'

// Chart Dimension:
=$(vDimSelect)

// Chart Measure (using Pick/Match for complex logic):
=Pick(Match('$(vMeasureSelect)', 'Sales', 'Profit', 'Margin'),
    Sum(Sales),
    Sum(Profit),
    Sum(Profit)/Sum(Sales)
)

// Dynamic Chart Title:
='$(vMeasureSelect) by $(vDimSelect)'
```

## 5. The "Metrics Excel File" Governance Model

For massive enterprise deployments, hardcoding variables in scripts doesn't scale. Maintain a central Excel file of all approved metrics.

See `assets/metrics-loader.qlik` for the script implementation.

**Governance Workflow:**
1. Business defines metric in Excel (Name, Formula, Description, Format).
2. Data Steward approves Excel file.
3. Reload runs → variables are created/updated.
4. Developers use variables in Master Items.
5. End users consume Master Items.

*Changes to formulas only happen in the Excel file, never in the app UI.*
