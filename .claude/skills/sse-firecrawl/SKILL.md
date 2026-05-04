---
name: sse-firecrawl
description: >
  Web scraping, document parsing, structured data extraction, web search,
  and AI agent research via Firecrawl SSE functions. Covers chart expressions
  for single-page scraping, bulk load script patterns for batch processing,
  PDF parsing, and agent-based research tasks. Use when integrating web data
  into Qlik apps.
license: Apache-2.0
platforms: ["client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: sse
---

# SSE Firecrawl Integration

## When to Use

- User wants to scrape web pages or parse documents into Qlik
- User needs to extract structured data from websites
- User mentions Firecrawl, web scraping, crawling, or web data extraction
- User wants to search the web and load results into Qlik
- User needs AI agent research tasks (multi-step web research)
- User wants to parse PDFs or local files via SSE

## Prerequisites

- qlik-py-tools running with Firecrawl support enabled
- API key configured in `.env`:
  - `FIRECRAWL_API_KEY` — Firecrawl API key (required)
- `firecrawl-py>=1.0.0` installed in the Python environment
- SSE analytics connection configured in QMC/Management Console

## Function Overview

| Function | ID | Type | Description |
|---|---|---|---|
| `Firecrawl_Scrape` | 51 | Scalar | Scrape a URL or local file (chart expression) |
| `Firecrawl_Scrape_Bulk` | 52 | Tensor | Scrape multiple URLs/files (load script) |
| `Firecrawl_Extract` | 53 | Scalar | Extract structured data via prompt (chart expression) |
| `Firecrawl_Extract_Bulk` | 54 | Tensor | Extract from multiple sources (load script) |
| `Firecrawl_Search` | 55 | Scalar | Web search (chart expression) |
| `Firecrawl_Search_Bulk` | 56 | Tensor | Web search (load script) |
| `Firecrawl_Agent` | 57 | Scalar | AI agent research task (chart expression) |
| `Firecrawl_Agent_Bulk` | 58 | Tensor | AI agent research (load script) |

**Scalar** = chart expression (single row in, single value out)
**Tensor** = load script (multi-row in, multi-column table out)

## Kwargs Rules

- **Delimiter:** Auto-detects `|` or `,` (normalizes pipe to comma internally)
- Both `'format=markdown, only_main_content=true'` and `'format=markdown|only_main_content=true'` work
- Uses `utils.get_kwargs()` after normalization (same as sklearn/LLM)

## Scraping

### Firecrawl_Scrape (Chart Expression)

Scrape a single URL or local file path. Returns content as a string.

| Kwarg | Values | Default | Description |
|---|---|---|---|
| `format` | markdown, html, rawHtml, links, screenshot | markdown | Output format |
| `only_main_content` | true/false | (auto) | Strip navigation/footers |
| `timeout` | integer (ms) | (auto) | Request timeout |
| `pdf_mode` | parse, ocr | (auto) | PDF handling mode |
| `pdf_max_pages` | integer | (auto) | Max PDF pages to process |
| `debug` | true/false | false | Debug logging |

```qlik
// Scrape a webpage as markdown
$(vSseConnection).Firecrawl_Scrape('https://example.com/pricing', 'format=markdown')

// Scrape with main content only
$(vSseConnection).Firecrawl_Scrape(URL, 'format=markdown, only_main_content=true')

// Parse a PDF
$(vSseConnection).Firecrawl_Scrape('https://example.com/report.pdf', 'pdf_mode=parse, pdf_max_pages=10')
```

### Firecrawl_Scrape_Bulk (Load Script)

Scrape multiple URLs/files. Returns table with columns: **key**, **source**, **content**.

```qlik
TRACE [Firecrawl] Scraping URLs...;

ScrapeInput:
LOAD
    ID as key,
    URL as source,
    'format=markdown, only_main_content=true' as kwargs
RESIDENT URLs;

ScrapeResults:
LOAD key, source, content
EXTENSION $(vSseConnection).Firecrawl_Scrape_Bulk(ScrapeInput{key, source, kwargs});

LET vScrapeRows = NoOfRows('ScrapeResults');
TRACE [Firecrawl] Scraped $(vScrapeRows) pages;

DROP TABLE ScrapeInput;
```

## Structured Extraction

### Firecrawl_Extract (Chart Expression)

Extract structured data from a URL using a natural language prompt. Returns extracted data as a string.

| Kwarg | Values | Default | Description |
|---|---|---|---|
| `enable_web_search` | true/false | false | Allow web search during extraction |
| `schema` | JSON string | (none) | JSON schema for structured output |
| `llm_provider` | openai, anthropic | openai | LLM provider for extraction |
| `debug` | true/false | false | Debug logging |

```qlik
// Extract product data with natural language prompt
$(vSseConnection).Firecrawl_Extract(
    'https://example.com/products',
    'Extract all product names, prices, and availability status'
)

// Extract with web search augmentation
$(vSseConnection).Firecrawl_Extract(
    'https://example.com/tyres',
    'Extract tyre specifications and pricing',
    'enable_web_search=true'
)
```

### Firecrawl_Extract_Bulk (Load Script)

Extract from multiple sources. Returns table with columns: **key**, **source**, **extracted**.

```qlik
TRACE [Firecrawl] Extracting data from sources...;

ExtractInput:
LOAD
    ID as key,
    URL as source,
    'Extract product names and prices' as prompt,
    'enable_web_search=true' as kwargs
RESIDENT Sources;

ExtractResults:
LOAD key, source, extracted
EXTENSION $(vSseConnection).Firecrawl_Extract_Bulk(ExtractInput{key, source, prompt, kwargs});

DROP TABLE ExtractInput;
```

## Web Search

### Firecrawl_Search (Chart Expression)

Perform a web search. Returns search results as a string.

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

Bulk web search. Returns table with columns: **key**, **query**, **results**.

```qlik
TRACE [Firecrawl] Running web searches...;

SearchInput:
LOAD
    ID as key,
    SearchQuery as query,
    'limit=5' as kwargs
RESIDENT Queries;

SearchResults:
LOAD key, query, results
EXTENSION $(vSseConnection).Firecrawl_Search_Bulk(SearchInput{key, query, kwargs});

DROP TABLE SearchInput;
```

## AI Agent Research

### Firecrawl_Agent (Chart Expression)

AI agent that performs multi-step research tasks. Returns research results as a string.

| Kwarg | Values | Default | Description |
|---|---|---|---|
| `model` | string | (auto) | Model for the agent |
| `max_credits` | integer | (auto) | Credit limit for agent execution |
| `debug` | true/false | false | Debug logging |

```qlik
// Agent research task
$(vSseConnection).Firecrawl_Agent(
    'https://example.com',
    'Research competitor pricing and summarize key findings'
)
```

### Firecrawl_Agent_Bulk (Load Script)

Bulk agent research. Returns table with columns: **key**, **source**, **result**.

```qlik
TRACE [Firecrawl] Running agent research tasks...;

AgentInput:
LOAD
    ID as key,
    URL as source,
    TaskDescription as prompt,
    'max_credits=100' as kwargs
RESIDENT Tasks;

AgentResults:
LOAD key, source, result
EXTENSION $(vSseConnection).Firecrawl_Agent_Bulk(AgentInput{key, source, prompt, kwargs});

DROP TABLE AgentInput;
```

## Best Practices

1. **Test connectivity first** — Ensure Firecrawl API key is configured and SSE is running
2. **Use `format=markdown`** for cleanest text output (default)
3. **Set `only_main_content=true`** to strip navigation/footers for cleaner scraping
4. **Use `pdf_mode=parse`** for text-based PDFs, `pdf_mode=ocr` for scanned documents
5. **Set reasonable `limit`** on search to control costs and response time
6. **Use bulk variants** for batch processing — more efficient than looping chart expressions
7. **Add TRACE** before and after every Firecrawl call for debugging
8. **Store kwargs in variables** for reusability:
   ```qlik
   SET vScrapeKwargs = 'format=markdown, only_main_content=true';
   SET vSearchKwargs = 'limit=5, scrape_content=true';
   ```
9. **Expect slow reloads** — Firecrawl calls make HTTP requests to external sites.
   Scraping, extraction, and especially agent tasks can take **minutes per URL**.
   When triggering reloads via MCP, use `reload_app(method="task")` or set
   `max_wait_seconds=600` (or higher) to avoid premature timeout.
10. **Prefer `Firecrawl_Extract_Bulk`** over scrape-then-LLM when you need structured
    data — it combines scraping and extraction in one SSE call, reducing total time.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| "Firecrawl module not loaded" | `firecrawl-py` not installed | Install: `pip install firecrawl-py>=1.0.0` |
| "API key not found" | Missing `FIRECRAWL_API_KEY` | Set in `.env` file on SSE server |
| Empty content returned | URL blocked or requires auth | Check URL accessibility, try different URL |
| Timeout on large sites | Page too complex or slow | Set `timeout` kwarg, use `only_main_content=true` |
| Reload times out at 120–300s | Firecrawl calls are inherently slow (HTTP to external sites) | Use `reload_app(method="task", max_wait_seconds=600)` or run reload from QMC |
| PDF parsing fails | Unsupported PDF format | Try `pdf_mode=ocr` instead of `parse` |
| Agent returns empty | Insufficient credits | Increase `max_credits` kwarg |
