---
name: sse-statsforecast
description: >
  Fast statistical forecasting in Qlik using Nixtla StatsForecast via SSE.
  Covers AutoARIMA, AutoETS, AutoTheta, MSTL, and intermittent demand models
  (CrostonSBA, IMAPA, TSB) for stock reorder predictions. Faster than Prophet
  for many use cases. Use when forecasting demand, especially intermittent or
  sparse demand patterns.
license: Apache-2.0
platforms: ["client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: sse
---

# SSE StatsForecast

## When to Use

- User wants fast statistical forecasting (faster than Prophet)
- User has intermittent/sparse demand data (spare parts, slow-moving inventory)
- User mentions ARIMA, ETS, Theta, or statistical models
- User needs baseline forecasts for comparison
- User wants multiple model comparison

## StatsForecast vs Prophet

| Feature | StatsForecast | Prophet |
|---|---|---|
| Speed | Very fast | Slower |
| Seasonality detection | Manual (season_length) | Automatic |
| Intermittent demand | Built-in models | Not supported |
| Holiday support | Not built-in | Native |
| External regressors | Not supported | Supported |
| Best for | High-volume, automated forecasting | Complex seasonal with holidays |

**Rule of thumb:** Use StatsForecast for speed and intermittent demand. Use Prophet when you need holiday awareness or external regressors.

## Available Models

### Auto-Selection Models
| Model | Best For |
|---|---|
| `AutoARIMA` | General purpose — automatically selects best ARIMA order |
| `AutoETS` | Data with clear trend and/or seasonality |
| `AutoTheta` | Quick seasonal forecasts, benchmarking |
| `AutoCES` | Complex exponential smoothing |

### Decomposition
| Model | Best For |
|---|---|
| `MSTL` | Multiple seasonal patterns (daily + weekly). **Requires `season_length`** |

### Intermittent Demand (Stock Reorder)
| Model | Best For |
|---|---|
| `CrostonSBA` | **Recommended default** — Syntetos-Boylan Approximation |
| `IMAPA` | Robust intermittent forecasting |
| `TSB` | Items with potential obsolescence |
| `CrostonClassic` | Original Croston method |
| `CrostonOptimized` | Optimized Croston variant |
| `ADIDA` | Aggregation-Disaggregation method |

### Baseline Models (for comparison)
| Model | Best For |
|---|---|
| `Naive` | Last value repeated (simplest baseline) |
| `SeasonalNaive` | Last season repeated. **Requires `season_length`** |
| `HistoricAverage` | Mean of all historical values |
| `WindowAverage` | Mean of recent window |
| `SeasonalWindowAverage` | Seasonal window average |

## Quick Start

### Chart Expression
```qlik
// AutoARIMA — 12-month forecast
$(vSseConnection).StatsForecast(OrderDate, Sum(Quantity), 'model=AutoARIMA, freq=MS, periods=12, return=yhat')
```

### Load Script
StatsForecast returns a **single numeric column** (one value per input row). It does NOT support `load_script=true`.
Use `return=yhat` (default) and alias with `AS`.
```qlik
SET vSseConnection = 'PyTools';

MonthlyDemand:
LOAD OrderDate, Sum(Quantity) as Demand
RESIDENT FactOrders GROUP BY OrderDate;

Forecast:
LOAD forecast_value as ForecastDemand
EXTENSION $(vSseConnection).StatsForecast(
    MonthlyDemand{OrderDate, Demand, 'model=AutoARIMA, freq=MS, periods=12, return=yhat'}
);

DROP TABLE MonthlyDemand;
```

**Note:** For multi-column output (ds, yhat, yhat_upper, etc.), use **Prophet** with `load_script=true` instead.

## Chart Expression Patterns

### General Purpose Forecasting
```qlik
// AutoARIMA — best all-around
$(vSseConnection).StatsForecast(OrderDate, Sum(Quantity), 'model=AutoARIMA, freq=MS, periods=12, return=yhat')

// Actuals + forecast in one series
$(vSseConnection).StatsForecast(OrderDate, Sum(Quantity), 'model=AutoARIMA, freq=MS, periods=12, return=y_then_yhat')

// With confidence intervals
$(vSseConnection).StatsForecast(OrderDate, Sum(Quantity), 'model=AutoARIMA, freq=MS, periods=12, return=yhat_upper, level=95')
$(vSseConnection).StatsForecast(OrderDate, Sum(Quantity), 'model=AutoARIMA, freq=MS, periods=12, return=yhat_lower, level=95')
```

### Exponential Smoothing
```qlik
$(vSseConnection).StatsForecast(OrderDate, Sum(Revenue), 'model=AutoETS, freq=MS, periods=6, return=yhat')
```

### Fast Seasonal (AutoTheta)
```qlik
$(vSseConnection).StatsForecast(OrderDate, Sum(UnitsSold), 'model=AutoTheta, freq=MS, periods=12, return=y_then_yhat')
```

### Multiple Seasonality (MSTL)
```qlik
// REQUIRES season_length parameter!
$(vSseConnection).StatsForecast(SalesDate, Sum(DailySales), 'model=MSTL, freq=D, periods=30, season_length=7, return=yhat')
```

### Intermittent Demand — Stock Reorder
```qlik
// CrostonSBA — recommended for spare parts, slow-moving items
$(vSseConnection).StatsForecast(OrderDate, Sum(OrderQty), 'model=CrostonSBA, freq=W, periods=8, return=y_then_yhat')

// IMAPA — robust alternative
$(vSseConnection).StatsForecast(OrderDate, Sum(OrderQty), 'model=IMAPA, freq=MS, periods=6, return=yhat')

// TSB — handles potential obsolescence
$(vSseConnection).StatsForecast(OrderDate, Sum(OrderQty), 'model=TSB, freq=W, periods=12, return=y_then_yhat')
```

### Baseline Comparisons
```qlik
// Seasonal Naive
$(vSseConnection).StatsForecast(OrderDate, Sum(Sales), 'model=SeasonalNaive, freq=MS, periods=12, season_length=12, return=yhat')

// Simple Naive
$(vSseConnection).StatsForecast(OrderDate, Sum(Sales), 'model=Naive, freq=MS, periods=6, return=yhat')

// Historic Average
$(vSseConnection).StatsForecast(OrderDate, Sum(Sales), 'model=HistoricAverage, freq=MS, periods=12, return=yhat')
```

## Kwargs Reference

| Kwarg | Values | Default | Description |
|---|---|---|---|
| `model` | See model tables above | AutoARIMA | Forecasting model |
| `freq` | D, W, MS, QS, YS | MS | Data frequency |
| `periods` | integer | 12 | Forecast horizon |
| `return` | yhat, yhat_upper, yhat_lower, y_then_yhat | yhat | Return type |
| `level` | 1-99 | 95 | Confidence level for intervals |
| `season_length` | integer | auto | Required for MSTL, SeasonalNaive |
| `take_log` | true/false | false | Log transform for multiplicative growth |
| `debug` | true/false | false | Enable debug logging |
| `n_jobs` | integer | 1 | Parallel workers (keep at 1 for SSE) |

## Frequency Codes

| Code | Meaning | Example |
|---|---|---|
| `D` | Daily | Daily sales |
| `W` | Weekly | Weekly aggregates |
| `MS` | Month Start | Monthly KPIs |
| `QS` | Quarter Start | Quarterly reporting |
| `YS` | Year Start | Annual forecasts |

## Choosing the Right Model

### Decision Tree
```
Is demand intermittent (many zero periods)?
├── YES → CrostonSBA (default), IMAPA (robust), TSB (obsolescence)
└── NO → Does data have clear seasonality?
    ├── YES → Multiple seasons? → MSTL (with season_length)
    │         Single season? → AutoETS or AutoTheta
    └── NO → AutoARIMA (general purpose)
```

### Model Comparison Pattern
Run multiple models and compare in a chart:

```qlik
// Create separate measures for each model:
// Measure 1: AutoARIMA
$(vSseConnection).StatsForecast(Date, Sum(Sales), 'model=AutoARIMA, freq=MS, periods=12, return=y_then_yhat')

// Measure 2: AutoETS
$(vSseConnection).StatsForecast(Date, Sum(Sales), 'model=AutoETS, freq=MS, periods=12, return=y_then_yhat')

// Measure 3: SeasonalNaive (baseline)
$(vSseConnection).StatsForecast(Date, Sum(Sales), 'model=SeasonalNaive, freq=MS, periods=12, season_length=12, return=y_then_yhat')
```

## Tips

1. **Start with AutoARIMA** — It's the best general-purpose model
2. **Use CrostonSBA for spare parts** — Designed for intermittent demand
3. **Always specify freq** — Must match your data granularity
4. **MSTL needs season_length** — Set to 7 for daily data with weekly pattern
5. **Compare against baselines** — If Naive beats your model, the data may not be forecastable
6. **Log transform for growth** — Use `take_log=true` for exponential trends
7. **StatsForecast is faster than Prophet** — Better for batch forecasting many series

[See assets/statsforecast-examples.qlik for ready-to-use expressions]
