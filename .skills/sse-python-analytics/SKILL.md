---
name: sse-python-analytics
description: >
  Connect Qlik to Python SSE (qlik-py-tools) for forecasting, ML, clustering,
  and LLM integration. Covers SSE architecture, connectivity setup, smoke testing,
  named function patterns for Prophet, sklearn, HDBSCAN, StatsForecast, and LLM
  calls. Use when building advanced analytics in Qlik via Server-Side Extensions.
license: Apache-2.0
platforms: ["client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: sse
---

# SSE Python Analytics

## When to Use

- User wants to add Python-powered analytics to Qlik
- User mentions SSE, qlik-py-tools, ScriptEval, or analytics connection
- User needs forecasting, ML, clustering, or LLM integration in Qlik
- User is troubleshooting SSE connectivity or function calls
- User asks about Prophet, sklearn, HDBSCAN, StatsForecast, or LLM in Qlik context

## What Is SSE?

**Server-Side Extensions (SSE)** allow Qlik to call external calculation engines via gRPC. The most common implementation is **qlik-py-tools**, which provides:

- **Prophet** — Time-series forecasting
- **StatsForecast** — Fast statistical models (AutoARIMA, AutoETS, intermittent demand)
- **sklearn** — Machine learning (XGBoost, LightGBM, RandomForest, etc.)
- **HDBSCAN** — Density-based clustering
- **LLM** — Claude, GPT, and other language models
- **Correlation** — Pearson, Spearman, Kendall
- **Firecrawl** — Web scraping, document parsing, structured extraction, web search, AI agent research

## Architecture

```
┌──────────────┐     gRPC (port 50055)     ┌────────────────────┐
│  Qlik Engine │ ◄──────────────────────►  │  qlik-py-tools     │
│              │     SSE Protocol          │  (Python server)   │
│  EXTENSION   │                           │  Prophet, sklearn, │
│  function()  │                           │  LLM, Cluster,     │
│              │                           │  Firecrawl         │
└──────────────┘                           └────────────────────┘
```

**Two calling patterns:**
1. **Chart expressions** — Real-time calculation, recalculated on selection
2. **Load script** — Bulk processing during reload, results stored in data model

## Setup Requirements

1. **qlik-py-tools running** — Container or service on accessible host:port
2. **Analytics connection** — Created in QMC/Management Console pointing to host:port
3. **Connection name variable** — `SET vSseConnection = 'PyTools';`
4. **Smoke test** — Verify connectivity before production calls

## Connectivity Smoke Test

**Always run this first to verify the SSE connection works:**

```qlik
///$tab SSE-Smoke-Test
SET ErrorMode = 0;
SET vSseConnection = 'PyTools';

LIB CONNECT TO '$(vSseConnection)';

SSE_Input:
LOAD 1 as RowId, 42 as FeatureValue AUTOGENERATE 1;

SSE_Output:
LOAD *
EXTENSION $(vSseConnection).ScriptEval(
  'python',
  'import pandas as pd\nresult = _arg1',
  'SSE_Input'
);

LET vSseRows = NoOfRows('SSE_Output');
IF vSseRows > 0 THEN
    TRACE SSE connection OK — $(vSseRows) rows returned;
ELSE
    TRACE ERROR: SSE returned no rows. Check connection and service status.;
END IF

DROP TABLE SSE_Input;
DROP TABLE SSE_Output;
SET ErrorMode = 1;
```

## Function Calling Patterns

### Chart Expression Pattern
```qlik
// Syntax: ConnectionName.FunctionName(args, 'kwargs')
$(vSseConnection).Prophet(OrderDate, Sum(Quantity), 'freq=D|periods=30|return=yhat')
```

- Evaluated per chart hypercube cell
- Results NOT stored in data model
- Good for interactive exploration
- kwargs use `|` or `,` as delimiter

### Load Script Pattern
```qlik
// Syntax: LOAD * EXTENSION ConnectionName.FunctionName(SourceTable{field1, field2, kwargs})
ResultTable:
LOAD *
EXTENSION $(vSseConnection).Prophet(
    DemandData{OrderDate, DailyDemand, 'freq=D|periods=30|return=all|load_script=true'}
);
```

- Executed during reload
- Results stored in data model
- Good for bulk processing
- Use `load_script=true` kwarg

### Bulk Pattern (for LLM and Predict)
```qlik
// Bulk functions take a table with key + data + kwargs columns
Results:
LOAD key, prompt, response
EXTENSION $(vSseConnection).LLM_Claude_Chat_Bulk(
    Prompts{key, prompt, kwargs}
);
```

## Available Function Categories

### Forecasting
| Function | Description |
|---|---|
| `Prophet` | Facebook Prophet time-series forecasting |
| `Prophet_Holidays` | Prophet with holiday calendar |
| `Prophet_Multivariate` | Prophet with external regressors |
| `StatsForecast` | Nixtla statistical models (AutoARIMA, AutoETS, etc.) |

### Machine Learning
| Function | Description |
|---|---|
| `sklearn_Setup` | Configure model (estimator, scaler, test split) |
| `sklearn_Set_Features` | Define feature columns and encoding |
| `sklearn_Fit` | Train the model |
| `sklearn_Predict` | Predict (chart expression) |
| `sklearn_Bulk_Predict` | Predict (load script, bulk) |
| `sklearn_Get_Metrics` | Get model evaluation metrics |
| `sklearn_Explain_Importances` | Feature importance scores |

### Clustering
| Function | Description |
|---|---|
| `Cluster` | HDBSCAN density-based clustering (features as **semicolon**-separated string) |
| `Cluster_by_Dim` | HDBSCAN clustering by dimension columns (supports `load_script=true`) |
| `Cluster_Geo` | HDBSCAN geo-clustering by latitude/longitude |

**Scalers:** `standard`, `robust`, `minmax`, `maxabs`, `quantile`, `none`

### Correlation
| Function | Description |
|---|---|
| `Correlation` | Correlation coefficient — pass method as 3rd arg: `'pearson'`, `'spearman'`, or `'kendall'` |
| `Pearson` | Shortcut for Pearson correlation (2 args only, no method arg needed) |

**Note:** There are no separate `Spearman` or `KendallTau` functions. Use `Correlation(series1, series2, 'spearman')` or `Correlation(series1, series2, 'kendall')`.

In chart expressions, series are passed as semicolon-separated concatenated strings:
```qlik
PyTools.Pearson(concat(Value1, ';'), concat(Value2, ';'))
PyTools.Correlation(concat(Value1, ';'), concat(Value2, ';'), 'spearman')
```

### spaCy NLP
| Function | Description |
|---|---|
| `spaCy_Get_Entities` | Named entity recognition on text |
| `spaCy_Get_Entities_From_Model` | NER using a custom-trained model |
| `spaCy_Retrain` | Retrain a spaCy model with custom data |

Returns table with columns: `key`, `entity`, `start`, `end`, `type`, `description`.

### LLM (Large Language Models)
| Function | Description |
|---|---|
| `LLM_Claude_Chat` | Claude (Haiku/Sonnet/Opus) single call |
| `LLM_Claude_Chat_Bulk` | Claude bulk calls (load script) |
| `LLM_Chat` | OpenAI GPT single call |
| `LLM_Chat_Bulk` | OpenAI GPT bulk calls (load script) |

### Firecrawl (Web Scraping & Data Extraction)
| Function | Description |
|---|---|
| `Firecrawl_Scrape` | Scrape a URL or local file (chart expression) |
| `Firecrawl_Scrape_Bulk` | Scrape multiple URLs/files (load script) — returns key, source, content |
| `Firecrawl_Extract` | Extract structured data via prompt (chart expression) |
| `Firecrawl_Extract_Bulk` | Extract from multiple sources (load script) — returns key, source, extracted |
| `Firecrawl_Search` | Web search (chart expression) |
| `Firecrawl_Search_Bulk` | Web search (load script) — returns key, query, results |
| `Firecrawl_Agent` | AI agent research task (chart expression) |
| `Firecrawl_Agent_Bulk` | AI agent research (load script) — returns key, source, result |

**Requires:** `FIRECRAWL_API_KEY` environment variable on the SSE server.

## Kwargs Reference

Kwargs (keyword arguments) are passed as a string. The delimiter depends on the function:

- **Prophet, Cluster, StatsForecast, Firecrawl** auto-detect `|` or `,`
- **sklearn** uses comma only (pipe reserved for type annotations)
- **LLM** (Chat/Claude) uses **comma only** (pipe NOT supported)
- **Association_Rules, Predict, Bulk_Predict** use **comma only**

```qlik
// Pipe-delimited (Prophet, Cluster, StatsForecast only)
'freq=D|periods=30|return=yhat|take_log=true'

// Comma-delimited (works for ALL functions)
'model=AutoARIMA, freq=MS, periods=12, return=yhat'
```

### Common kwargs across functions:
| Kwarg | Values | Description |
|---|---|---|
| `debug` | `true/false` | Enable debug logging |
| `load_script` | `true/false` | Enable load script mode |
| `return` | varies | What to return (yhat, all, y_then_yhat, etc.) |

## Best Practices

1. **Always smoke test first** — Don't assume the SSE service is running
2. **Use variables for connection name** — `SET vSseConnection = 'PyTools';`
3. **Add TRACE before and after** every SSE call for debugging
4. **Handle errors gracefully** — Use `SET ErrorMode = 0;` around SSE calls
5. **Test with small data first** — Before bulk LLM calls or large predictions
6. **Keep kwargs in variables** for reusability:
   ```qlik
   SET vProphetKwargs = 'freq=D|periods=30|return=yhat';
   // $(vSseConnection).Prophet(Date, Sum(Qty), '$(vProphetKwargs)')
   ```
7. **Log SSE results** — `TRACE SSE returned $(NoOfRows('ResultTable')) rows;`
8. **Use named functions** instead of raw `ScriptEval` where available

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| "Connection failed" | SSE service not running | Start qlik-py-tools container |
| "No rows returned" | Empty input data | Check source table has rows |
| Timeout | Large dataset or slow model | Increase gRPC timeout, reduce data size |
| "Function not found" | Typo in function name | Check exact function name spelling |
| Wrong results | Kwargs format error | Check delimiter (`\|` vs `,`), no spaces around `=` |
| "Permission denied" | Analytics connection not configured | Create connection in QMC/Management Console |

[See references/sse-architecture.md for gRPC protocol details]
[See references/function-catalog.md for all available functions and kwargs]
[See references/troubleshooting.md for detailed error resolution]
[See assets/ for ready-to-use SSE script templates]
