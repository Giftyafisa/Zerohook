---
name: qlik-insight-advisor
description: >
  Improve Qlik Cloud AI experiences such as Insight Advisor, Insight Advisor
  Chat, business logic, vocabulary, and analyst-friendly semantic setup. Use
  when AI answers, chart suggestions, or natural-language exploration need to
  become more reliable.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "2.0"
  category: qlik-ai
---

# Qlik Insight Advisor

## When to Use

- User wants better Insight Advisor or Insight Advisor Chat results
- User asks about business logic, logical models, or semantic setup
- User needs help with vocabulary, measure defaults, or hierarchy design
- User wants natural-language questions to return better charts and explanations
- User is enabling AI workflows in Qlik Cloud and needs analyst-ready guidance

## Cloud-First Outcome

The goal is not “turn AI on.” The goal is a model that lets analysts ask natural questions and get trustworthy results.

Default priorities:
- clean associative model
- explicit field classification
- business logic that reflects how the business talks
- vocabulary for synonyms and domain terms
- measure definitions that prevent poor defaults

Without that setup, AI features usually fall back to generic or misleading answers.

## Business Logic Essentials

Treat business logic as a semantic contract between the data model and the user.

Define clearly:
- dimensions versus measures
- default aggregations
- time fields and calendar behavior
- hierarchies for drill paths
- business-friendly names and synonyms

Good examples:
- `Revenue` defaults to `Sum`
- `CustomerID` defaults to `Count Distinct` when used as a measure
- `OrderDate` is the primary analysis calendar
- `Gross Margin` is named consistently across expressions, master items, and vocabulary

## Vocabulary And Analyst Language

Vocabulary is where many AI improvements happen fastest.

Map real analyst terms to the model:
- “revenue” -> sales measure
- “margin” -> approved margin definition
- “top customers” -> ranked customer measure pattern
- “year to date” -> the intended date field and comparison logic

Best practices:
- include common business abbreviations
- use one canonical term per important KPI
- avoid conflicting synonyms for different metrics
- hide technical key fields from AI-facing exploration where appropriate

## Model Design That Helps AI

Insight Advisor works best when the data model is understandable:

- keep shared keys intentional and minimal
- avoid ambiguous date roles without explicit naming
- separate technical fields from user-facing analysis fields
- use master items and business logic to reinforce the approved semantic layer

If a question could map to multiple date fields or multiple sales measures, name and classify them explicitly.

## Prompt And Query Guidance

When helping users form better questions, recommend:
- a measure
- a dimension
- a time frame
- a comparison or ranking when needed

Examples:
- “Show revenue by region for this quarter”
- “Compare order count this month versus last month”
- “Which products had the highest margin decline in EMEA?”

This matters because vague prompts often expose semantic weaknesses rather than AI capability limits.

## Troubleshooting Poor Results

When Insight Advisor underperforms, check in this order:

1. Is the model clean and understandable?
2. Are fields classified correctly?
3. Are default aggregations sensible?
4. Are business terms present in vocabulary?
5. Are key dates and hierarchies explicit?
6. Are technical or duplicate fields confusing the AI surface?

## If Client-Managed

Some semantic and business-logic concepts still help on client-managed deployments, but Cloud has the richer AI feature set.

If the user needs parity guidance, keep the answer short and make it clear which features are Cloud-first.

## Delivery Expectations

When responding:
- prioritize semantic setup over generic AI enthusiasm
- recommend business logic and vocabulary changes before workaround-heavy prompt advice
- distinguish analyst-facing improvements from model-quality fixes

## References

- Pair with `qlik-master-items` for governed metric definitions
- Pair with `qlik-data-modeling` when the root cause is the associative model rather than the AI layer
