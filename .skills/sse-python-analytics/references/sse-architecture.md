# SSE Architecture — gRPC Protocol Details

## How SSE Works

Qlik's Server-Side Extension protocol uses **gRPC** (Google Remote Procedure Call) to communicate between the Qlik Engine and external calculation engines.

```
Qlik Engine                          SSE Plugin (qlik-py-tools)
    │                                        │
    │── GetCapabilities() ──────────────────►│  (on connect)
    │◄── capabilities, functions ────────────│
    │                                        │
    │── ExecuteFunction(functionId, data) ──►│  (on chart calc / reload)
    │◄── result rows ───────────────────────│
    │                                        │
    │── EvaluateScript(script, data) ───────►│  (ScriptEval calls)
    │◄── result rows ───────────────────────│
```

## Connection Types

### On-Premise (QSEoW)
Configured in **QMC → Analytic connections**:
- **Name**: The connection name used in scripts (e.g., `PyTools`)
- **Host**: IP/hostname of the SSE server
- **Port**: gRPC port (default: 50055)
- **Certificate**: Optional TLS for production

### Qlik Cloud
Configured in **Management Console → Analytics connections**:
- Same concept, but connection goes through Qlik's cloud gateway
- May require additional network configuration (firewall, VPN)

## gRPC Message Size

Default gRPC message size limit is **10 MB**. For large datasets:

```
# In qlik-py-tools configuration:
MAX_MESSAGE_LENGTH = 104857600  # 100 MB
```

If you hit size limits, consider:
1. Reducing the number of fields sent
2. Batching data into smaller chunks
3. Increasing the message size limit on both Qlik and SSE sides

## Data Flow

### Chart Expression Flow
```
1. User makes selection in Qlik app
2. Chart recalculates → sends hypercube data to Engine
3. Engine calls SSE function with the data subset
4. SSE processes and returns results
5. Chart displays the results
```

- Data sent = only the visible/filtered rows
- Recalculated on every selection change
- Suitable for small-medium datasets

### Load Script Flow
```
1. Reload starts → script executes sequentially
2. EXTENSION statement sends entire source table to SSE
3. SSE processes all rows at once
4. Results stored as a new table in the data model
5. Results persist until next reload
```

- Data sent = entire source table
- Processed once during reload
- Suitable for large datasets, bulk operations

## ScriptEval vs Named Functions

### ScriptEval (Raw Python)
Execute arbitrary Python code:
```qlik
EXTENSION $(vSseConnection).ScriptEval(
  'python',
  'import pandas as pd\ndf = _arg1.copy()\ndf["Score"] = df["Value"] * 2\nresult = df',
  'SourceTable'
);
```

- Flexible but harder to maintain
- Security risk if untrusted code
- No parameter validation

### Named Functions (Recommended)
Pre-defined functions with validated parameters:
```qlik
EXTENSION $(vSseConnection).Prophet(
    Data{DateField, ValueField, 'freq=D|periods=30|return=all|load_script=true'}
);
```

- Type-safe, validated kwargs
- Documented parameters
- Better error messages
- Easier to audit

## Protocol Buffers Schema

The SSE protocol is defined in `ServerSideExtension.proto`:

```protobuf
// Key message types:
message BundledRows {
    repeated Row rows = 1;
}

message Row {
    repeated Dual duals = 1;
}

message Dual {
    double numData = 1;    // Numeric value
    string strData = 2;    // String value
}
```

Every value sent between Qlik and SSE is a **Dual** (number + string). The SSE plugin decides which part to use based on the function definition.

## Deployment Patterns

### Docker (Recommended)
```bash
docker run -d \
  --name qlik-py-tools \
  -p 50055:50055 \
  -v /path/to/.env:/app/.env \
  nabeel-oz/qlik-py-tools:latest
```

### Systemd Service
```ini
[Unit]
Description=Qlik Py Tools SSE
After=network.target

[Service]
ExecStart=/usr/bin/python3 /opt/qlik-py-tools/ExtensionService_pytools.py
Restart=always
Environment=PYTHONPATH=/opt/qlik-py-tools

[Install]
WantedBy=multi-user.target
```

### Multiple SSE Plugins
Qlik can connect to multiple SSE plugins simultaneously:
- `PyTools` on port 50055 — Prophet, sklearn, clustering
- `LLMTools` on port 50056 — LLM-specific functions
- Each gets its own analytics connection in QMC

## Security Considerations

1. **Network isolation** — SSE should only be accessible from Qlik Engine nodes
2. **TLS encryption** — Use certificates for production gRPC connections
3. **API keys** — LLM functions require API keys in `.env` (never in scripts)
4. **ScriptEval lockdown** — Consider disabling raw ScriptEval in production
5. **Resource limits** — Set memory/CPU limits on SSE containers
