# SSE Troubleshooting Guide

## Quick Diagnostics

### Step 1: Is the SSE service running?
```bash
# Check if the port is listening
netstat -an | grep 50055

# Or test with curl (gRPC health)
curl -v http://localhost:50055

# Docker container status
docker ps | grep qlik-py-tools
docker logs qlik-py-tools --tail 50
```

### Step 2: Can Qlik reach the SSE?
Run the smoke test in a reload using a **named function** (do NOT use ScriptEval — most installations have `allowScript=False`):
```qlik
SET ErrorMode = 0;
SET vSseConnection = 'PyTools';

SSE_Test:
LOAD Date(Today() - RecNo()) as ds, Round(Rand() * 100) as y AUTOGENERATE 30;

SSE_Result:
LOAD * EXTENSION $(vSseConnection).Prophet(
    SSE_Test{ds, y, 'return=yhat, freq=D, load_script=true'}
);

LET vRows = NoOfRows('SSE_Result');
TRACE SSE test returned $(vRows) rows;

DROP TABLE SSE_Test;
IF vRows > 0 THEN
    DROP TABLE SSE_Result;
END IF
SET ErrorMode = 1;
```

### Step 3: Is the function available?
```qlik
// Check if a named function exists by calling it with minimal data
SET ErrorMode = 0;
TRACE Testing Prophet function...;

_TestInput:
LOAD Date(Today() - RecNo()) as TestDate, RecNo() as TestValue AUTOGENERATE 30;

_TestOutput:
LOAD * EXTENSION $(vSseConnection).Prophet(
    _TestInput{TestDate, TestValue, 'freq=D|periods=1|return=yhat|load_script=true'}
);

TRACE Prophet test: $(NoOfRows('_TestOutput')) rows returned;
DROP TABLES _TestInput, _TestOutput;
SET ErrorMode = 1;
```

---

## Common Errors & Fixes

### "Connector could not be found" / "Connection failed"

**Cause:** Analytics connection not configured or SSE service not reachable.

**Fixes:**
1. Verify the analytics connection exists in QMC → Analytic connections
2. Check the host:port in the connection settings
3. Verify the SSE service is running and accessible from ALL engine nodes
4. Check firewalls between Qlik Engine and SSE host
5. For Docker: ensure port mapping is correct (`-p 50055:50055`)

### "No rows returned" (Empty result)

**Cause:** Input data is empty or SSE function returned nothing.

**Fixes:**
1. Add `TRACE` before the SSE call to verify input table has rows:
   ```qlik
   TRACE Input rows: $(NoOfRows('InputTable'));
   ```
2. Check if the source table fields match what the function expects
3. Add `debug=true` kwarg to enable server-side logging
4. Check qlik-py-tools logs for errors

### "Timeout" / "Deadline exceeded"

**Cause:** Processing takes too long (large dataset, slow model, LLM rate limiting).

**Fixes:**
1. Reduce input data size for testing
2. Increase gRPC timeout in Qlik Engine settings
3. For LLM bulk calls: reduce batch size
4. For sklearn: reduce n_estimators or max_depth
5. Check SSE server CPU/memory usage

### "Function not found" / "Unknown function"

**Cause:** Typo in function name or function not available in this version.

**Fixes:**
1. Check exact spelling (case-sensitive): `Prophet`, `sklearn_Predict`, `LLM_Claude_Chat`
2. Verify qlik-py-tools version supports the function
3. Check qlik-py-tools startup logs for registered functions

### "Invalid argument" / "Parameter error"

**Cause:** Wrong kwargs format or invalid values.

**Fixes:**
1. Check kwargs delimiter — Prophet/Cluster/StatsForecast auto-detect `|` or `,`; LLM/sklearn/Common use **comma only**
2. No spaces around `=`: `freq=D` not `freq = D` (whitespace is stripped from all values)
3. Verify the kwarg name is correct (case-sensitive)
4. Check value is valid for the parameter (e.g., `freq` must be D/W/MS/QS/YS)

### Wrong/unexpected results

**Cause:** Data format mismatch or incorrect kwargs.

**Fixes:**
1. **Dates not recognized:** Ensure dates are proper Qlik date values (numeric), not strings
2. **Aggregation missing:** Chart expressions need `Sum()`, `Avg()`, etc. around measure fields
3. **Wrong return type:** Check `return` kwarg (yhat vs y_then_yhat vs all)
4. **Frequency mismatch:** `freq=D` expects daily data — if you have monthly, use `freq=MS`
5. **Not enough data:** Prophet needs at least 2 full seasons of data for seasonal patterns

### "Permission denied" / "Access denied"

**Cause:** Qlik user doesn't have access to the analytics connection.

**Fixes:**
1. In QMC: Check analytics connection security rules
2. Ensure the connection is shared with the appropriate user/group
3. For Qlik Cloud: verify the connection is in the correct space

### LLM-specific: "API key not configured"

**Cause:** Missing or incorrect API keys in qlik-py-tools `.env` file.

**Fixes:**
1. Check `.env` file has the correct Azure keys:
   ```
   # Azure OpenAI (GPT)
   AZURE_OPENAI_API_KEY=your-key
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
   AZURE_OPENAI_DEPLOYMENT=gpt-4o
   AZURE_OPENAI_API_VERSION=2025-11-01-preview

   # Claude (Azure AI Foundry)
   AZURE_FOUNDRY_API_KEY=your-key
   AZURE_FOUNDRY_CLAUDE_API_ENDPOINT=https://your-resource.services.ai.azure.com/
   AZURE_CLAUDE_SONNET=claude-sonnet-4-5
   AZURE_CLAUDE_HAIKU=claude-haiku-model-name
   AZURE_CLAUDE_OPUS=claude-opus-model-name
   ```
2. Restart the SSE service after changing `.env`
3. Verify API key is valid (test directly with curl)

### LLM-specific: "Rate limit exceeded"

**Cause:** Too many concurrent LLM calls.

**Fixes:**
1. Reduce batch size in bulk calls
2. Add delays between batches (use Qlik's `Sleep()` function)
3. Use a cheaper/faster model for bulk operations (haiku vs sonnet)
4. Check provider rate limits and upgrade plan if needed

---

## Diagnostic TRACE Pattern

Add this around every SSE call for production scripts:

```qlik
LET vStepStart = Now();
TRACE [SSE] Calling Prophet with $(NoOfRows('InputData')) input rows...;

ResultData:
LOAD * EXTENSION $(vSseConnection).Prophet(
    InputData{Date, Value, '$(vProphetKwargs)'}
);

LET vStepEnd = Now();
LET vDuration = Interval(vStepEnd - vStepStart, 'mm:ss');
LET vResultRows = NoOfRows('ResultData');
TRACE [SSE] Prophet returned $(vResultRows) rows in $(vDuration);

IF vResultRows = 0 THEN
    TRACE [SSE] WARNING: No results from Prophet. Check SSE logs.;
END IF
```

## Log Locations

| Component | Log Location |
|---|---|
| qlik-py-tools (Docker) | `docker logs qlik-py-tools` |
| qlik-py-tools (service) | Stdout or configured log file |
| Qlik Engine (QSEoW) | `C:\ProgramData\Qlik\Sense\Log\Engine\` |
| Qlik Cloud | Management Console → Monitoring → Reload logs |
| Qlik reload log | In-app: TRACE statements visible in reload log |
