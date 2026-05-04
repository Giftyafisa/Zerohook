---
name: sse-llm-integration
description: >
  Use Claude, GPT, and other LLMs in Qlik via SSE for text analysis,
  recommendations, and data enrichment. Covers chart expressions for
  interactive queries, bulk load script patterns for batch processing,
  prompt engineering, structured output, cost estimation, and model
  selection. Use when integrating AI language models into Qlik apps.
license: Apache-2.0
platforms: ["client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: sse
---

# SSE LLM Integration

## When to Use

- User wants to add AI/LLM capabilities to a Qlik app
- User mentions Claude, GPT, ChatGPT, LLM, or AI recommendations
- User needs text analysis, summarization, or classification at scale
- User wants to enrich data with AI-generated insights during reload
- User asks about prompt engineering or structured output in Qlik

## Prerequisites

- qlik-py-tools running with LLM support enabled
- API keys configured in `.env`:
  - **Azure OpenAI (GPT):** `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT` (default: gpt-4o), `AZURE_OPENAI_API_VERSION`
  - **Claude (via Azure AI Foundry):** `AZURE_FOUNDRY_API_KEY`, `AZURE_FOUNDRY_CLAUDE_API_ENDPOINT`, `AZURE_FOUNDRY_API_VERSION`
  - **Claude model overrides (optional):** `AZURE_CLAUDE_HAIKU`, `AZURE_CLAUDE_SONNET`, `AZURE_CLAUDE_OPUS`
- Analytics connection configured (e.g., `PyTools`)

## kwargs Delimiter

**LLM functions use COMMA-only kwargs** (not pipe). The pipe `|` delimiter is NOT supported for LLM_Chat, LLM_Chat_Bulk, LLM_Claude_Chat, or LLM_Claude_Chat_Bulk.

**Limitation:** The kwargs parser strips all whitespace from values. Multi-word `system_prompt` values will have spaces removed. Use hyphens or underscores for multi-word prompts:
```qlik
// ✅ Works (no spaces in system_prompt value)
'system_prompt=Be-concise-and-return-JSON, temperature=0'

// ❌ Broken (spaces stripped → "Beconciseandreturn JSON")
'system_prompt=Be concise and return JSON, temperature=0'
```

## Model Selection

| Model | Speed | Cost | Best For |
|---|---|---|---|
| **Claude Haiku** | Fast | Low | Simple classification, yes/no, short answers |
| **Claude Sonnet** | Medium | Medium | Analysis, recommendations, structured output |
| **Claude Opus** | Slow | High | Complex reasoning, detailed reports |
| **GPT (default)** | Medium | Medium | General purpose, chat-style queries |

**Rule of thumb:**
- **Haiku** for high-volume, simple tasks (thousands of rows)
- **Sonnet** for balanced quality/cost (hundreds of rows)
- **Opus** for complex analysis (tens of rows)

## Chart Expression Patterns

### Quick Classification (Haiku — Fast & Cheap)
```qlik
$(vSseConnection).LLM_Claude_Chat(
    'Is this product at risk of stockout? Stock: ' & CurrentStock
    & ', Avg Daily Sales: ' & AvgDailySales
    & ', Lead Time: ' & LeadTimeDays & ' days. Answer YES or NO.',
    'model=haiku, temperature=0'
)
```

### Recommendation (Sonnet — Balanced)
```qlik
$(vSseConnection).LLM_Claude_Chat(
    'Product: ' & ProductName
    & '. Predicted demand: ' & Round(PredictedDemand, 1) & ' units/day'
    & '. Current stock: ' & CurrentStock
    & '. Lead time: ' & LeadTimeDays & ' days'
    & '. Recommend: reorder point, reorder quantity, and safety stock.',
    'model=sonnet, system_prompt=Supply-chain-AI-return-JSON, temperature=0'
)
```

### Deep Analysis (Opus — Best Quality)
```qlik
$(vSseConnection).LLM_Claude_Chat(
    'Perform root cause analysis on why ' & ProductName
    & ' had ' & StockoutDays & ' stockout days last quarter.'
    & ' Historical data: ' & SalesHistory,
    'model=opus, system_prompt=Senior-supply-chain-consultant, max_tokens=4096'
)
```

### GPT Alternative
```qlik
$(vSseConnection).LLM_Chat(
    'Summarize this sales trend: ' & Concat(DISTINCT MonthYear & ':' & Sum(Sales), '; '),
    'system_prompt=Retail-analyst-be-concise, temperature=0.3'
)
```

## Bulk Load Script Patterns

### Claude Bulk — Batch Recommendations
```qlik
///$tab LLM-Bulk-Recommendations
SET vSseConnection = 'PyTools';

// Step 1: Prepare prompts from your data model
ClaudePrompts:
LOAD
    ProductID as key,
    'Given: Product=' & ProductName
        & ', Category=' & Category
        & ', AvgDailySales=' & Round(Avg(DailySales), 0.1)
        & ', LeadTimeDays=' & LeadTimeDays
        & ', CurrentStock=' & CurrentStock
        & ', SafetyStockDays=' & SafetyDays
        & '. Calculate the optimal reorder point and economic order quantity.'
        as prompt,
    'model=sonnet, system_prompt=Inventory-optimization-AI-return-JSON, temperature=0.2, max_tokens=500'
        as kwargs
RESIDENT DimProducts;

LET vPromptCount = NoOfRows('ClaudePrompts');
TRACE [LLM] Sending $(vPromptCount) prompts to Claude Sonnet...;
LET vLlmStart = Now();

// Step 2: Call Claude in bulk
ClaudeResults:
LOAD key, prompt, response
EXTENSION $(vSseConnection).LLM_Claude_Chat_Bulk(ClaudePrompts{key, prompt, kwargs});

LET vLlmDuration = Interval(Now() - vLlmStart, 'mm:ss');
TRACE [LLM] Complete in $(vLlmDuration): $(NoOfRows('ClaudeResults')) responses;

DROP TABLE ClaudePrompts;
```

### GPT Bulk — Alternative
```qlik
GPTPrompts:
LOAD
    ProductID as key,
    'Analyze demand for: ' & ProductName
        & '. Avg daily sales: ' & Avg(DailySales)
        & '. Lead time: ' & LeadTimeDays & ' days.'
        as prompt,
    'system_prompt=Supply-chain-analyst-return-JSON, temperature=0.2'
        as kwargs
RESIDENT DimProducts;

GPTResults:
LOAD key, prompt, response
EXTENSION $(vSseConnection).LLM_Chat_Bulk(GPTPrompts{key, prompt, kwargs});

DROP TABLE GPTPrompts;
```

## Prompt Engineering Tips

### 1. Be Specific
```
❌ "Analyze this product"
✅ "Given Product=Widget-A, AvgDailySales=50, LeadTime=14 days, CurrentStock=200. Is this product at risk of stockout in the next 30 days? Answer YES or NO with a one-sentence explanation."
```

### 2. Request Structured Output
```
❌ "Give me a recommendation"
✅ "Return JSON: {\"action\": \"reorder|hold|reduce\", \"quantity\": N, \"reasoning\": \"...\"}"
```

### 3. Use System Prompts
```qlik
'system_prompt=Supply-chain-optimization-AI-return-valid-JSON-no-markdown'
```

### 4. Control Temperature
- `temperature=0` — Deterministic, reproducible (best for business logic)
- `temperature=0.3` — Slightly creative (good for summaries)
- `temperature=0.7` — Creative (good for brainstorming, NOT for data)

### 5. Set Token Limits
```qlik
'max_tokens=200'    // Short answers (YES/NO, classification)
'max_tokens=500'    // Medium answers (JSON recommendation)
'max_tokens=2048'   // Long answers (detailed analysis)
```

## Cost Estimation

### Per-Token Costs (Approximate)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|---|---|---|
| Claude Haiku | $0.25 | $1.25 |
| Claude Sonnet | $3.00 | $15.00 |
| Claude Opus | $15.00 | $75.00 |

### Estimating Your Cost

```
Cost = (InputTokens × InputRate + OutputTokens × OutputRate) × RowCount

Example: 1000 products × Sonnet
- Input: ~200 tokens/prompt × 1000 = 200K tokens → $0.60
- Output: ~100 tokens/response × 1000 = 100K tokens → $1.50
- Total: ~$2.10 per reload
```

**Tip:** Test with 10 rows first, then estimate total cost before bulk runs.

## Handling LLM Responses

### Parse JSON Responses
After bulk LLM calls, parse the JSON responses in Qlik:

```qlik
// Assuming ClaudeResults has: key, prompt, response
// Where response is JSON like: {"action": "reorder", "quantity": 500}

ParsedResults:
LOAD
    key,
    TextBetween(response, '"action": "', '"') as RecommendedAction,
    Num(TextBetween(response, '"quantity": ', ',')) as RecommendedQty,
    TextBetween(response, '"reasoning": "', '"') as Reasoning
RESIDENT ClaudeResults;
```

### Error Handling
```qlik
ParsedResults:
LOAD
    key,
    If(Len(response) > 0 AND SubStringCount(response, '"action"') > 0,
        TextBetween(response, '"action": "', '"'),
        'ERROR: No valid response'
    ) as RecommendedAction
RESIDENT ClaudeResults;
```

## Best Practices

1. **Test with small batches first** — 5-10 rows before running thousands
2. **Use the cheapest model that works** — Haiku for simple tasks
3. **Set temperature=0** for business-critical outputs
4. **Always request structured output** (JSON) for machine-parseable results
5. **Monitor costs** — Track token usage per reload
6. **Cache results** — Store LLM responses in QVDs to avoid re-processing
7. **Add error handling** — Check for empty/malformed responses
8. **Rate limiting** — Large batches may hit API rate limits; reduce batch size

## Caching LLM Results

Avoid re-processing unchanged data by storing results in QVDs:

```qlik
// After LLM call:
STORE ClaudeResults INTO [lib://QVD/llm_results.qvd] (qvd);

// On next reload, only process new/changed items:
_Existing:
LOAD * FROM [lib://QVD/llm_results.qvd] (qvd);

_NewItems:
LOAD ProductID as key, ... as prompt, ... as kwargs
RESIDENT DimProducts
WHERE NOT EXISTS(key, ProductID);  // Only items not already processed
```

[See assets/llm-chart-expressions.qlik for chart expression examples]
[See assets/llm-bulk-reload.qlik for bulk processing patterns]
