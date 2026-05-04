---
name: qlik-application-automation
description: >
  Build Qlik Cloud automation workflows for reload orchestration, alerts,
  reporting, approvals, and downstream actions. Use when a process should be
  event-driven or scheduled outside the load script itself.
license: Apache-2.0
platforms: ["cloud"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "2.0"
  category: qlik-integration
---

# Qlik Application Automation

## When to Use

- User needs post-reload orchestration in Qlik Cloud
- User wants data-driven alerts, notifications, or approvals
- User needs scheduled report delivery or operational follow-up actions
- User wants to trigger external systems after a reload or business event
- User asks whether a workflow belongs in script, API code, or an automation

## What Automations Are Best At

Qlik Application Automation is best for orchestration, notifications, lightweight branching, and SaaS integrations.

Use automations for:
- chaining reload-dependent steps
- sending Slack, Teams, or email notifications
- distributing reports after data refresh
- pushing small decisions or status updates into other systems
- coordinating approvals or exception handling

Do not use automations for:
- heavy row-by-row data processing
- transformations that belong in Qlik script or upstream ETL
- large-volume writeback that needs a purpose-built integration service

## Cloud-First Patterns

### 1. Reload Orchestration

Use automations to control sequence and failure handling across apps:

- Trigger extract app reload
- Wait for completion
- Branch on success or failure
- Trigger transform or analytics reloads only after success
- Send an operational alert when the chain fails

This is the right pattern when multiple apps form a Cloud pipeline.

### 2. Alerting And Exception Flows

Use automations when a KPI or status needs a human response:

- run after reload or on a schedule
- retrieve a measure, status, or field value
- compare against a threshold
- notify the right audience with context and links

Keep the alert payload compact and actionable.

### 3. Reporting Distribution

Use automations for Cloud-native report distribution and follow-up:

- trigger after a validated reload
- generate or distribute the right report artifact
- route it to users, groups, or channels
- record success or failure when the process matters operationally

### 4. External System Handoffs

Use automations when Qlik should notify or update another SaaS platform:

- incident or ticket creation
- downstream webhook call
- CRM or collaboration update
- governed approval step

## Script Versus Automation

Choose the boundary explicitly:

| Put It In Script | Put It In Automation |
|---|---|
| data extraction and transformation | event orchestration |
| QVD generation | notifications |
| row-level calculations | approval steps |
| heavy pipeline logic | cross-system handoffs |

If the user is trying to do large-scale data shaping in an automation, steer them back to script or ETL.

## Reliability Rules

- Always wait for reload completion before triggering dependent steps
- Stop the chain explicitly on critical failures
- Include app name, reload ID, environment, and timestamp in failure alerts
- Keep automation responsibilities narrow enough to debug quickly
- Prefer a few composable automations over one giant flow when the process has distinct phases

## Delivery Expectations

When designing an automation, state:
- the trigger
- the decision points
- the failure behavior
- the ownership of notifications or approvals
- which work still belongs in script, QVD layers, or upstream systems

## References

- Pair with `qlik-cloud-deployment` for promotion and reload operating models
- Pair with `qlik-cloud-reporting` when the automation is distributing Cloud-native reports
- See `assets/webhook-trigger.qlik` for script-to-webhook integration patterns when a script must trigger a downstream automation
