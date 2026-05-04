# Qlik-CLI Cheatsheet

`qlik-cli` provides command-line access to Qlik Cloud APIs. This is essential for CI/CD pipelines, bulk operations, and automated administration.

## Authentication & Context

```bash
# Initialize a new context (prompts for tenant URL and API key)
qlik context init

# List available contexts
qlik context ls

# Switch context (e.g., from DEV to PROD tenant)
qlik context use <context-name>
```

## App Management

```bash
# List all apps in a space
qlik item ls --spaceId <space-id> --resourceType app

# Get App ID by Name
qlik item ls --name "Sales Dashboard" --resourceType app | jq -r '.[0].id'

# Export an app (without data)
qlik app export <app-id> --NoData > exported_app.qvf

# Import an app to a specific space
qlik app import --file exported_app.qvf --spaceId <target-space-id> --name "New App Name"

# Publish an app to a Managed Space
qlik app publish <app-id> --spaceId <managed-space-id>

# Delete an app
qlik app rm <app-id>
```

## Reloads & Tasks

```bash
# Trigger a reload (returns immediately)
qlik reload create --appId <app-id>

# Trigger a reload and wait for completion (ideal for CI/CD)
# (Requires custom polling script, as CLI doesn't natively block)
RELOAD_ID=$(qlik reload create --appId <app-id> -q)
qlik reload get $RELOAD_ID

# List recent reloads for an app
qlik reload ls --appId <app-id>
```

## Spaces Management

```bash
# List all spaces
qlik space ls

# Create a new shared space
qlik space create --name "CI_CD_Staging" --type shared

# Get space ID by name
qlik space ls --name "Production" | jq -r '.[0].id'
```

## CI/CD Specific (App Serialization)

Using the `unbuild` and `build` commands allows you to store Qlik apps as text in Git.

```bash
# Unpack QVF into source files (JSON + QVS)
qlik app unbuild <app-id> --dir ./app_src

# The resulting directory contains:
# /app_src/script.qvs
# /app_src/properties.json
# /app_src/objects/...

# Rebuild QVF from source files
qlik app build --dir ./app_src --app <new-app-id>
```

## Script Management

```bash
# Extract just the load script from an app
qlik app script get <app-id> > load_script.qvs

# Update the load script of an app
qlik app script set <app-id> --file load_script.qvs
```

## Data Connections

```bash
# List data connections in a space
qlik connection ls --spaceId <space-id>

# Create a new data connection (REST example)
qlik connection create --name "MyAPI" --type "REST" --spaceId <space-id> --connectionString "https://api.example.com"
```

## Advanced Formatting with `jq`

Since `qlik-cli` outputs JSON by default (or can be forced with `--json`), use `jq` to parse the output in shell scripts.

```bash
# Get the status of the last reload
qlik reload ls --appId <app-id> --limit 1 --json | jq -r '.[0].status'

# Get all app IDs in a space
qlik item ls --spaceId <space-id> --resourceType app --json | jq -r '.[].id'
```
