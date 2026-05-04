---
name: sse-prophet-forecasting
description: >
  Build time-series forecasts in Qlik using Facebook Prophet via SSE.
  Covers chart expressions and load script patterns, frequency selection,
  parameter tuning, holidays, multivariate regressors, and result
  interpretation. Use when forecasting demand, sales, or any time-series.
license: Apache-2.0
platforms: ["client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: sse
---

# SSE Prophet Forecasting

## When to Use

- User wants to forecast future values from historical time-series data
- User mentions Prophet, forecasting, demand planning, or sales prediction
- User needs confidence intervals around forecasts
- User has seasonal data with trends
- User wants holiday-aware or multivariate forecasts

## Prerequisites

- qlik-py-tools running with Prophet installed
- Analytics connection configured (e.g., `PyTools`)
- At least 2 full seasons of historical data for seasonal detection

## Quick Start

### Chart Expression (Interactive)
```qlik
// 30-day demand forecast
$(vSseConnection).Prophet(OrderDate, Sum(Quantity), 'freq=D, periods=30, return=yhat')
```

### Load Script (Bulk)
```qlik
SET vSseConnection = 'PyTools';

DemandData:
LOAD OrderDate, Sum(Quantity) as DailyDemand
RESIDENT FactOrders GROUP BY OrderDate;

ForecastResults:
LOAD *
EXTENSION $(vSseConnection).Prophet(
    DemandData{OrderDate, DailyDemand, 'freq=D, periods=30, return=all, load_script=true'}
);

DROP TABLE DemandData;
```

## Frequency Selection

| Code | Meaning | Use When |
|---|---|---|
| `D` | Daily | Daily sales, web traffic |
| `W` | Weekly | Weekly reports, aggregated sales |
| `MS` | Month Start | Monthly KPIs, financial data |
| `QS` | Quarter Start | Quarterly reporting |
| `YS` | Year Start | Annual forecasts |

**Critical:** The `freq` must match your data's actual granularity. Daily data with `freq=MS` will give wrong results.

## Return Types

| Value | Description | Best For |
|---|---|---|
| `yhat` | Forecast values only (future periods) | Simple forecast line |
| `yhat_upper` | Upper confidence bound | Confidence band |
| `yhat_lower` | Lower confidence bound | Confidence band |
| `residual` | y − yhat for history, null for future | Error analysis |
| `y_then_yhat` | Actuals for history, forecast for future | Combined chart |
| `y_then_yhat_upper` | Actuals then upper bound | Combined with confidence |
| `y_then_yhat_lower` | Actuals then lower bound | Combined with confidence |
| `trend` | Trend component only | Trend analysis |
| `all` | All columns (load script only) | Full analysis |

## Chart Expression Patterns

### Basic Forecast
```qlik
// Future forecast only
$(vSseConnection).Prophet(OrderDate, Sum(Quantity), 'freq=D, periods=30, return=yhat')

// Actuals + forecast in one series
$(vSseConnection).Prophet(OrderDate, Sum(Quantity), 'freq=D, periods=30, return=y_then_yhat')
```

### With Confidence Intervals
```qlik
// Three expressions for a forecast band chart:
// Measure 1: Main forecast
$(vSseConnection).Prophet(OrderDate, Sum(Qty), 'freq=D, periods=30, return=y_then_yhat')

// Measure 2: Upper bound
$(vSseConnection).Prophet(OrderDate, Sum(Qty), 'freq=D, periods=30, return=yhat_upper, interval_width=0.95')

// Measure 3: Lower bound
$(vSseConnection).Prophet(OrderDate, Sum(Qty), 'freq=D, periods=30, return=yhat_lower, interval_width=0.95')
```

### Weekly & Monthly Variants
```qlik
// Weekly forecast
$(vSseConnection).Prophet(WeekStart, Sum(Revenue), 'freq=W, periods=12, return=yhat')

// Monthly forecast with log transform (multiplicative growth)
$(vSseConnection).Prophet(MonthStart, Sum(Units), 'freq=MS, periods=6, return=yhat, take_log=true')
```

### Trend Component
```qlik
$(vSseConnection).Prophet(OrderDate, Sum(Qty), 'freq=D, periods=30, return=trend')
```

## Additional Prophet Functions

### Prophet_Basic (No kwargs)
A simplified 2-parameter variant — just date and value, no kwargs string:
```qlik
$(vSseConnection).Prophet_Basic(OrderDate, Sum(Quantity))
```

### Prophet_Seasonality
Extract the seasonal component of a Prophet forecast:
```qlik
$(vSseConnection).Prophet_Seasonality(
    Month, $(vConcatSeries), $(vHolidays),
    'seasonality=yearly, freq=MS, debug=true'
)
```
The `seasonality` kwarg selects which component: `yearly`, `weekly`, or a custom seasonality name.

### Prophet_Seasonality_Multivariate
Same as Prophet_Seasonality but with additional regressors (same signature as Prophet_Multivariate + seasonality kwarg).

## Holiday-Aware Forecasts

Prophet can account for holidays that cause demand spikes/drops:

```qlik
// Chart expression — pass holiday name as third argument
$(vSseConnection).Prophet_Holidays(
    OrderDate, Sum(Quantity), HolidayName,
    'freq=D, periods=30, return=yhat'
)
```

The `HolidayName` field should contain the holiday name (e.g., "Christmas", "Black Friday") for dates that are holidays, and be empty/null for non-holiday dates.

## Multivariate Forecasts (External Regressors)

Add external factors like promotions, temperature, or marketing spend:

```qlik
$(vSseConnection).Prophet_Multivariate(
    OrderDate,
    Sum(Quantity),
    HolidayName,
    IsPromotion & '|' & Temperature,
    'prior_scale=10, mode=additive',
    'freq=D, periods=30, return=yhat'
)
```

| Kwarg | Values | Description |
|---|---|---|
| `prior_scale` | float (default 10) | How much weight to give regressors |
| `mode` | additive, multiplicative | How regressors combine with trend |

**Note:** Future regressor values must be known/estimated for the forecast period.

## Load Script Pattern (Full)

```qlik
///$tab Prophet-Forecast
SET vSseConnection = 'PyTools';

// Step 1: Prepare source data (one row per date, one measure)
DemandData:
LOAD
    OrderDate,
    Sum(Quantity) as DailyDemand
RESIDENT FactOrders
GROUP BY OrderDate;

TRACE Prophet input: $(NoOfRows('DemandData')) rows;

// Step 2: Run forecast
LET vStart = Now();

ForecastResults:
LOAD *
EXTENSION $(vSseConnection).Prophet(
    DemandData{OrderDate, DailyDemand, 'freq=D, periods=30, return=all, load_script=true'}
);

LET vDuration = Interval(Now() - vStart, 'mm:ss');
TRACE Prophet complete in $(vDuration): $(NoOfRows('ForecastResults')) rows;

DROP TABLE DemandData;
```

## Parameter Tuning

| Parameter | Default | Adjust When |
|---|---|---|
| `freq` | D | Match to your data granularity |
| `periods` | 30 | Business needs (shorter = more accurate) |
| `interval_width` | 0.8 | 0.95 for tighter bands, 0.5 for wider |
| `take_log` | false | True if data has multiplicative seasonality (exponential growth) |
| `changepoint_prior_scale` | 0.05 | Decrease for overfit trend, increase for underfit |
| `seasonality_mode` | additive | `multiplicative` if seasonal amplitude grows with level |
| `n_changepoints` | 25 | Number of potential changepoints |
| `changepoint_range` | 0.8 | Fraction of history for changepoints |
| `holidays_prior_scale` | 10 | Regularize holiday effects |
| `debug` | false | Print detailed logs to terminal and log file |

### When to Use `take_log=true`
- Revenue that grows exponentially
- Data with variance proportional to level
- Seasonal amplitude that increases over time

### Choosing `periods`
- **Short-term** (7-30 days): Most accurate, good for operational planning
- **Medium-term** (30-90 days): Good for tactical planning
- **Long-term** (90-365 days): Less accurate, use for strategic planning only

## Interpreting Results

When using `return=all` in load script mode, you get:

| Column | Description |
|---|---|
| `ds` | Date |
| `y` | Actual value (null for future dates) |
| `yhat` | Forecast value |
| `yhat_lower` | Lower confidence bound |
| `yhat_upper` | Upper confidence bound |
| `trend` | Trend component |
| `seasonal` | Combined seasonal component |

## Common Issues

| Issue | Fix |
|---|---|
| Flat forecast (no seasonality) | Need more historical data (2+ seasons) |
| Wild swings in forecast | Try `take_log=true` or reduce `periods` |
| Holiday spikes not captured | Use `Prophet_Holidays` with holiday field |
| Forecast too high/low | Check for outliers in historical data |
| "freq mismatch" error | Ensure `freq` matches actual data interval |
| Duplicate dates in data | Handled automatically — Prophet deduplicates internally, forecast is merged back to all original rows |

[See assets/prophet-chart-expressions.qlik for ready-to-use chart expressions]
[See assets/prophet-load-script.qlik for complete load script pattern]
