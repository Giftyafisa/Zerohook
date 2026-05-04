# SSE Function Catalog — qlik-py-tools

Complete reference for all named functions available in qlik-py-tools.

## Forecasting Functions

### Prophet
**Time-series forecasting using Facebook Prophet.**

| Kwarg | Values | Default | Description |
|---|---|---|---|
| `freq` | D, W, MS, QS, YS | D | Data frequency |
| `periods` | integer | 30 | Forecast horizon |
| `return` | yhat, yhat_upper, yhat_lower, trend, y_then_yhat, all | yhat | What to return |
| `interval_width` | 0.0-1.0 | 0.8 | Confidence interval width |
| `take_log` | true/false | false | Log transform (multiplicative seasonality) |
| `load_script` | true/false | false | Load script mode |
| `debug` | true/false | false | Debug logging |

```qlik
// Chart expression
$(vSseConnection).Prophet(OrderDate, Sum(Qty), 'freq=D|periods=30|return=yhat')

// Load script
LOAD * EXTENSION $(vSseConnection).Prophet(Data{Date, Value, 'freq=MS|periods=12|return=all|load_script=true'});
```

### Prophet_Holidays
**Prophet with holiday calendar.**

Additional kwargs:
| Kwarg | Values | Description |
|---|---|---|
| (same as Prophet) | | Plus holiday field in function args |

```qlik
$(vSseConnection).Prophet_Holidays(OrderDate, Sum(Qty), HolidayName, 'freq=D|periods=30|return=yhat')
```

### Prophet_Multivariate
**Prophet with external regressors (promotions, weather, etc.).**

Additional kwargs:
| Kwarg | Values | Description |
|---|---|---|
| `prior_scale` | float | Regressor prior scale |
| `mode` | additive, multiplicative | Regressor mode |

```qlik
$(vSseConnection).Prophet_Multivariate(
    OrderDate, Sum(Qty), HolidayName,
    IsPromotion & '|' & Temperature,
    'prior_scale=10|mode=additive',
    'freq=D|periods=30|return=yhat'
)
```

### StatsForecast
**Nixtla statistical forecasting models.**

| Kwarg | Values | Default | Description |
|---|---|---|---|
| `model` | AutoARIMA, AutoETS, AutoTheta, AutoCES, MSTL, Naive, SeasonalNaive, HistoricAverage, CrostonSBA, IMAPA, TSB | AutoARIMA | Model to use |
| `freq` | D, W, MS, QS, YS | MS | Data frequency |
| `periods` | integer | 12 | Forecast horizon |
| `return` | yhat, yhat_upper, yhat_lower, y_then_yhat | yhat | What to return |
| `level` | integer (1-99) | 95 | Confidence level for intervals |
| `season_length` | integer | auto | Required for MSTL, SeasonalNaive |
| `take_log` | true/false | false | Log transform |
| `debug` | true/false | false | Debug logging |

```qlik
// AutoARIMA
$(vSseConnection).StatsForecast(Date, Sum(Sales), 'model=AutoARIMA, freq=MS, periods=12, return=yhat')

// Intermittent demand (spare parts)
$(vSseConnection).StatsForecast(Date, Sum(OrderQty), 'model=CrostonSBA, freq=W, periods=8, return=y_then_yhat')
```

---

## Machine Learning Functions

### sklearn_Setup
**Configure a new ML model.**

| Kwarg | Values | Description |
|---|---|---|
| `estimator` | XGBRegressor, XGBClassifier, LGBMRegressor, RandomForestRegressor, etc. | Algorithm |
| `n_estimators` | integer | Number of trees |
| `learning_rate` | float | Learning rate |
| `max_depth` | integer | Tree depth |
| `scaler` | StandardScaler, RobustScaler, MinMaxScaler, none | Feature scaling |
| `test_size` | 0.0-1.0 | Train/test split |
| `random_state` | integer | Reproducibility seed |
| `debug` | true/false | Debug logging |

```qlik
Setup:
LOAD * INLINE [
    model_name, estimator_args, scaler_args, execution_args
    my_model, estimator=XGBRegressor|n_estimators=200|max_depth=8, scaler=RobustScaler, test_size=0.2|random_state=42
];

LOAD * EXTENSION $(vSseConnection).sklearn_Setup(Setup{model_name, estimator_args, scaler_args, execution_args});
```

### sklearn_Set_Features
**Define feature columns for the model.**

| Column | Values | Description |
|---|---|---|
| `var_type` | feature, target, identifier, excluded | Role of the field |
| `data_type` | int, float, str | Data type |
| `strategy` | none, one_hot_encoding, hashing, text_similarity, count_vectorizing, tf_idf | Encoding strategy |
| `strategy_args` | varies | Strategy-specific parameters |

```qlik
Features:
LOAD * INLINE [
    model_name, feature_name, var_type, data_type, strategy, strategy_args
    my_model, Sales, feature, float, none,
    my_model, Category, feature, str, one_hot_encoding,
    my_model, Target, target, float, none,
];

LOAD * EXTENSION $(vSseConnection).sklearn_Set_Features(Features{model_name, feature_name, var_type, data_type, strategy, strategy_args});
```

### sklearn_Fit
**Train the model on data.**

```qlik
TrainingData:
LOAD 'my_model' as model_name, Sales, Category, Target RESIDENT FactData;

LOAD * EXTENSION $(vSseConnection).sklearn_Fit(TrainingData{model_name, Sales, Category, Target});
```

### sklearn_Get_Metrics
**Get model evaluation metrics.**

Returns: R², MAE, RMSE (regression) or accuracy, precision, recall, F1 (classification).

```qlik
MetricsInput: LOAD 'my_model' as model_name AUTOGENERATE 1;
LOAD * EXTENSION $(vSseConnection).sklearn_Get_Metrics(MetricsInput{model_name});
```

### sklearn_Explain_Importances
**Get feature importance scores.**

```qlik
Input: LOAD 'my_model' as model_name AUTOGENERATE 1;
LOAD * EXTENSION $(vSseConnection).sklearn_Explain_Importances(Input{model_name});
```

### sklearn_Predict (Chart Expression)
```qlik
$(vSseConnection).sklearn_Predict('my_model', Feature1 & '|' & Feature2 & '|' & Feature3)
```

### sklearn_Bulk_Predict (Load Script)
```qlik
PredData:
LOAD 'my_model' as model_name, ID as key, Feature1, Feature2 RESIDENT SourceData;

LOAD * EXTENSION $(vSseConnection).sklearn_Bulk_Predict(PredData{model_name, key, Feature1, Feature2});
```

---

## Clustering Functions

### Cluster
**HDBSCAN density-based clustering. Features use SEMICOLON `;` separator.**

| Kwarg | Values | Default | Description |
|---|---|---|---|
| `scaler` | standard, robust, minmax, maxabs, quantile, none | robust | Feature scaling |
| `min_cluster_size` | integer | 5 | Minimum cluster members |
| `min_samples` | integer | auto | Core point threshold |
| `load_script` | true/false | false | Load script mode (Cluster_by_Dim) |
| `debug` | true/false | false | Debug logging |

```qlik
// Standard clustering — features separated by SEMICOLONS
$(vSseConnection).Cluster(ProductID, Sales & ';' & Margin & ';' & Turnover, 'scaler=standard, min_cluster_size=5')

// Two-dimension clustering
$(vSseConnection).Cluster_by_Dim(Dim1, Dim2, Sum(Measure), 'scaler=standard, load_script=true')

// Geospatial clustering
$(vSseConnection).Cluster_Geo(LocationID, Latitude, Longitude, 'min_cluster_size=5')
```

---

## Correlation Functions

### Pearson / Correlation

Only two functions exist: `Pearson` (shortcut) and `Correlation` (with method argument).
There are **no** separate `Spearman` or `KendallTau` functions.

Series are passed as semicolon-separated concatenated strings in chart expressions:

```qlik
// Pearson (shortcut — no method argument)
$(vSseConnection).Pearson(concat(Value1, ';'), concat(Value2, ';'))

// Spearman — use Correlation with method argument
$(vSseConnection).Correlation(concat(Value1, ';'), concat(Value2, ';'), 'spearman')

// Kendall — use Correlation with method argument
$(vSseConnection).Correlation(concat(Value1, ';'), concat(Value2, ';'), 'kendall')
```

---

## LLM Functions

### LLM_Claude_Chat (Single Call)

| Kwarg | Values | Default | Description |
|---|---|---|---|
| `model` | haiku, sonnet, opus | sonnet | Claude model |
| `system_prompt` | string | none | System instructions |
| `temperature` | 0.0-1.0 | 0.7 | Randomness |
| `max_tokens` | integer | 2048 | Max response length |

```qlik
$(vSseConnection).LLM_Claude_Chat(
    'Analyze: ' & ProductName & ', Sales: ' & Sum(Sales),
    'model=sonnet, system_prompt=Retail-analyst-be-concise, temperature=0'
)
```

**Kwargs delimiter**: COMMA only (no pipe). system_prompt whitespace is stripped — use hyphens.

### LLM_Claude_Chat_Bulk (Load Script)

```qlik
Prompts:
LOAD ID as key, PromptText as prompt, 'model=haiku, temperature=0' as kwargs RESIDENT Data;

LOAD key, prompt, response
EXTENSION $(vSseConnection).LLM_Claude_Chat_Bulk(Prompts{key, prompt, kwargs});
```

### LLM_Chat / LLM_Chat_Bulk
Same patterns as Claude but for OpenAI GPT models. **Kwargs delimiter**: COMMA only.

| Kwarg | Values | Default | Description |
|---|---|---|---|
| `system_prompt` | string | none | System instructions |
| `temperature` | 0.0-1.0 | 0.7 | Randomness |
| `max_tokens` | integer | 2048 | Max response length |

---

## Firecrawl Functions (Web Scraping & Data Extraction)

**Requires:** `FIRECRAWL_API_KEY` environment variable on the SSE server.
**Kwargs delimiter:** Auto-detects `|` or `,` (normalizes pipe to comma internally).

### Firecrawl_Scrape (Chart Expression)
**Scrape a single URL or local file.**

| Kwarg | Values | Default | Description |
|---|---|---|---|
| `format` | markdown, html, rawHtml, links, screenshot | markdown | Output format |
| `only_main_content` | true/false | (auto) | Strip navs/footers |
| `timeout` | integer (ms) | (auto) | Request timeout |
| `pdf_mode` | parse, ocr | (auto) | PDF handling mode |
| `pdf_max_pages` | integer | (auto) | Max PDF pages to process |
| `debug` | true/false | false | Debug logging |

```qlik
// Scrape a webpage as markdown
$(vSseConnection).Firecrawl_Scrape(URL, 'format=markdown')

// Scrape with options
$(vSseConnection).Firecrawl_Scrape('https://example.com/pricing', 'format=markdown, only_main_content=true')
```

### Firecrawl_Scrape_Bulk (Load Script)
**Scrape multiple URLs/files. Returns: key, source, content.**

```qlik
ScrapeInput:
LOAD ID as key, URL as source, 'format=markdown, only_main_content=true' as kwargs RESIDENT URLs;

LOAD key, source, content
EXTENSION $(vSseConnection).Firecrawl_Scrape_Bulk(ScrapeInput{key, source, kwargs});
```

### Firecrawl_Extract (Chart Expression)
**Extract structured data from a URL via natural language prompt.**

| Kwarg | Values | Default | Description |
|---|---|---|---|
| `enable_web_search` | true/false | false | Allow web search during extraction |
| `schema` | JSON string | (none) | JSON schema for structured output |
| `llm_provider` | openai, anthropic | openai | LLM provider for extraction |
| `debug` | true/false | false | Debug logging |

```qlik
// Extract product data
$(vSseConnection).Firecrawl_Extract('https://example.com/products', 'Extract product names and prices')

// Extract with web search enabled
$(vSseConnection).Firecrawl_Extract('https://example.com/tyres', 'Extract tyre specifications', 'enable_web_search=true')
```

### Firecrawl_Extract_Bulk (Load Script)
**Extract from multiple sources. Returns: key, source, extracted.**

```qlik
ExtractInput:
LOAD ID as key, URL as source, PromptText as prompt, 'enable_web_search=true' as kwargs RESIDENT Sources;

LOAD key, source, extracted
EXTENSION $(vSseConnection).Firecrawl_Extract_Bulk(ExtractInput{key, source, prompt, kwargs});
```

### Firecrawl_Search (Chart Expression)
**Web search via Firecrawl.**

| Kwarg | Values | Default | Description |
|---|---|---|---|
| `limit` | integer | (auto) | Max number of results |
| `location` | string | (none) | Geographic location filter |
| `tbs` | string | (none) | Time-based search filter |
| `scrape_content` | true/false | false | Also scrape each result page |
| `debug` | true/false | false | Debug logging |

```qlik
// Simple search
$(vSseConnection).Firecrawl_Search('auto truck tyre pricing Australia', 'limit=5')

// Search with content scraping
$(vSseConnection).Firecrawl_Search('competitor pricing data', 'limit=3, scrape_content=true')
```

### Firecrawl_Search_Bulk (Load Script)
**Bulk web search. Returns: key, query, results.**

```qlik
SearchInput:
LOAD ID as key, SearchQuery as query, 'limit=5' as kwargs RESIDENT Queries;

LOAD key, query, results
EXTENSION $(vSseConnection).Firecrawl_Search_Bulk(SearchInput{key, query, kwargs});
```

### Firecrawl_Agent (Chart Expression)
**AI agent that performs multi-step research tasks.**

| Kwarg | Values | Default | Description |
|---|---|---|---|
| `model` | string | (auto) | Model for the agent |
| `max_credits` | integer | (auto) | Credit limit for agent execution |
| `debug` | true/false | false | Debug logging |

```qlik
// Agent research task
$(vSseConnection).Firecrawl_Agent('https://example.com', 'Research competitor pricing and summarize findings')
```

### Firecrawl_Agent_Bulk (Load Script)
**Bulk agent research. Returns: key, source, result.**

```qlik
AgentInput:
LOAD ID as key, URL as source, TaskDescription as prompt, 'max_credits=100' as kwargs RESIDENT Tasks;

LOAD key, source, result
EXTENSION $(vSseConnection).Firecrawl_Agent_Bulk(AgentInput{key, source, prompt, kwargs});
```
