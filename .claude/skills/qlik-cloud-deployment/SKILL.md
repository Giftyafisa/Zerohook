---
name: qlik-cloud-deployment
description: >
  Deploy and operate Qlik Cloud apps with sound space strategy, connection
  portability, promotion rules, reload orchestration, and gateway-aware data
  handling. Use when moving apps through DEV, UAT, and PROD in Qlik Cloud.
license: Apache-2.0
platforms: ["cloud"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "2.0"
  category: qlik-cloud
---

# Qlik Cloud Deployment

## When to Use

- User is promoting apps across DEV, UAT, and PROD in Qlik Cloud
- User asks about Shared, Managed, or Data space operating models
- User needs connection portability or environment-specific script strategy
- User is designing reload schedules or multi-app promotion workflows
- User wants Cloud-safe deployment guidance without QSEoW-only patterns

## Cloud-First Defaults

Use these defaults unless the user says their tenant works differently:

- Build in a Personal or Shared space, not directly in a Managed space
- Promote into Managed spaces only after validation and ownership checks
- Keep connection names stable across environments whenever possible
- Prefer QVD or file-based staged flows over direct live access for repeatable reloads
- Treat Data Gateway as an explicit dependency, not an invisible implementation detail

## Recommended Promotion Model

Use a simple lifecycle that separates development, validation, and governed consumption:

| Stage | Space Type | Purpose |
|---|---|---|
| DEV | Personal or Shared | Build script, model, and visuals |
| UAT | Shared | Collaborative testing and sign-off |
| PROD | Managed | Governed published analytics |

Promotion rules:
- Only publish or copy validated apps forward
- Keep one clear owner per production app
- Avoid editing production apps in place except for controlled hotfixes
- Document whether reload ownership lives with the app owner, a space admin, or an automation

## Connection Portability

The safest Cloud deployment scripts avoid hard-coding tenant- or space-specific assumptions.

Preferred patterns:
- Reuse the same logical connection names in each environment
- Use variables for environment-specific library roots when names must differ
- Keep `lib://` references explicit and Cloud-safe
- Call out missing connections instead of inventing them

Example:

```qlik
SET vQvdConnection = 'QVD_Store';
SET vDataConnection = 'Source_Files';

LOAD * FROM [lib://$(vQvdConnection)/sales.qvd] (qvd);
LOAD * FROM [lib://$(vDataConnection)/customers.csv]
(txt, utf8, embedded labels, delimiter is ',');
```

If environment names must differ:

```qlik
SET vEnvironment = 'DEV';

IF '$(vEnvironment)' = 'PROD' THEN
    SET vQvdConnection = 'PROD_QVD_Store';
ELSEIF '$(vEnvironment)' = 'UAT' THEN
    SET vQvdConnection = 'UAT_QVD_Store';
ELSE
    SET vQvdConnection = 'DEV_QVD_Store';
END IF
```

## Gateway-Aware Deployment Guidance

When the source lives behind a firewall, treat gateway usage as part of the deployment design:

- Confirm whether the app depends on Qlik Data Gateway before promoting
- Track which environments have the required gateway and connector configuration
- Prefer extract-to-QVD patterns when gateway latency, database concurrency, or reload duration are unstable
- Use direct live connectivity only when freshness requirements clearly justify the added operational risk

If the workflow depends on gateway-backed ODBC or JDBC access, say so explicitly in the response.

## Reload And Promotion Practices

Use these patterns for reliable Cloud operations:

- Separate extract, transform, and analytics apps when the pipeline is large or reused
- Schedule downstream reloads only after upstream completion is confirmed
- Keep production reload windows predictable and documented
- Use Qlik Application Automation or supported APIs for orchestration, not ad hoc manual chains
- Prefer non-destructive promotion patterns such as copy, import, or publish over editing one app across every stage

## What To Avoid

- QSEoW-only connection guidance such as `CONNECT TO`, UNC paths, or server-local file paths
- Treating Managed spaces like development workspaces
- Reusing production connections in development without deliberate controls
- Hiding gateway dependencies inside “just reload it” guidance
- Mixing deployment advice with unrelated CI/CD serialization detail unless the user is specifically asking about source control

## Delivery Expectations

When helping with Cloud deployment tasks:
- Default to Cloud-safe `lib://` guidance
- Name the required spaces, connections, reload dependencies, and gateway assumptions
- Distinguish deployment mechanics from CI/CD tooling choices
- Add a short client-managed note only if the user explicitly needs parity guidance

## References

- Qlik Cloud deployment and promotion guidance belongs here when the user needs tenant-specific operational help
- Pair with `qlik-application-automation` for orchestration workflows
- Pair with `qlik-data-gateway-connectivity` when behind-firewall connectivity changes the design
