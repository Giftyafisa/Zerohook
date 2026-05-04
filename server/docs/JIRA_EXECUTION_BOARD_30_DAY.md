# Zerohook 30-Day Execution Board (Remaining Packs)

## Scope Update
- Data seeding is removed from the active execution plan.
- Live Ghana seeding will only be retried after credentials are fixed and explicit approval is given.

## Completed P0 Packs
- Runtime feature flags wired into request context and status control endpoints.
- Recommendation rollback switch implemented and operational.
- API contract guard middleware added for strict `{ success, data, message }` normalization.
- Integration tests added for rollback path, feature-flag control, and API contract middleware.

## Jira Ticket Board (Remaining)

| Ticket | Type | Pack | Summary | Owner | Supporting Owners | Target Week | Dependencies | Acceptance Criteria |
|---|---|---|---|---|---|---|---|---|
| ZH-P0-021 | Story | P0-Access-1 | Enforce role access matrix across `users`, `sugarAccess`, `bookings`, `chat` routes | BackendArchitect | SecurityAuditor | Week 1 | Existing auth middleware | Unauthorized role requests return 403 with contract response and tests cover client/provider/sugar matrix |
| ZH-P0-022 | Story | P0-Access-2 | Split sugar visibility gate from subscription gate (paid sugar access only) | BackendArchitect | database | Week 1 | ZH-P0-021 | Provider access to sugar profiles requires active sugar payment record independent of subscription |
| ZH-P0-023 | Task | P0-Access-3 | Add one-year connection expiry enforcement for provider ↔ sugar links | BackendArchitect | SecurityAuditor | Week 1 | ZH-P0-022 | Expired links are blocked server-side, renewal path documented, tests cover expiry boundary |
| ZH-P0-024 | Story | P0-Trust-1 | Restrict sugar feeds to well-verified providers only (server enforced) | BackendArchitect | SecurityAuditor | Week 1 | ZH-P0-021 | Sugar recommendation queries include verification threshold and reject low-verification providers |
| ZH-P0-025 | Task | P0-Contract-2 | Migrate top 10 high-traffic routes to explicit `data/message` payloads (remove silent normalization reliance) | BackendArchitect | FrontendArchitect | Week 1 | API contract middleware | Routes return canonical contract without requiring guard mutation |
| ZH-P0-026 | Task | P0-Contract-3 | Add contract regression integration suite for auth, users, chat, payments, status endpoints | DevOpsEngineer | BackendArchitect | Week 1 | ZH-P0-025 | CI gate fails on any route missing success/data/message |
| ZH-P0-027 | Task | P0-Ops-1 | Add admin audit log for feature-flag/rollback changes | BackendArchitect | SecurityAuditor | Week 1 | Existing status feature-flag endpoints | Every flag toggle stores actor, old value, new value, timestamp |
| ZH-P0-028 | Task | P0-Ops-2 | Add rollback runbook endpoint docs and post-toggle health checks | DevOpsEngineer | BackendArchitect | Week 1 | ZH-P0-027 | Runbook includes switch commands, verification checklist, and rollback success metrics |
| ZH-P1-031 | Bug | P1-UX-1 | Fix profile settings click wiring on profile page | FrontendArchitect | DebuggerAgent | Week 2 | Route inventory audit | Settings control opens expected destination/modal on desktop + mobile |
| ZH-P1-032 | Bug | P1-UX-2 | Resolve invisible unread messages mismatch (badge vs visible list) | FrontendArchitect | RealtimeEngineer | Week 2 | Chat query and unread status review | Badge count equals rendered unread items after refresh and after read action |
| ZH-P1-033 | Bug | P1-UX-3 | Fix profile card skeletons not hydrating with loaded data | FrontendArchitect | BackendArchitect | Week 2 | Feed API response validation | Skeletons transition to cards reliably within normal request times |
| ZH-P1-034 | Story | P1-UX-4 | Fix tablet breakpoint gap (900-1199px) for nav/layout consistency | FrontendArchitect | DebuggerAgent | Week 2 | App layout audit | No overlap or dead-nav state on tablet widths |
| ZH-P1-035 | Task | P1-UX-5 | Resolve z-index collisions (bottom nav, drawer, toast layers) | FrontendArchitect | RealtimeEngineer | Week 2 | ZH-P1-034 | Interactive controls remain clickable across all overlays |
| ZH-P1-036 | Story | P1-Access-UI-1 | Build provider sugar-discovery page gated by sugar payment state | FrontendArchitect | BackendArchitect | Week 2 | ZH-P0-022 | Providers without sugar access see paywall; paid providers see sugar profiles |
| ZH-P1-037 | Story | P1-Access-UI-2 | Add sugar privacy controls UI (visibility toggle + preference defaults) | FrontendArchitect | SecurityAuditor | Week 2 | Existing sugar visibility APIs | Sugar users can toggle visibility and save defaults with clear privacy state |
| ZH-P1-038 | Task | P1-Quality-1 | Add E2E tests for role-specific feed visibility and discovery surfaces | DevOpsEngineer | FrontendArchitect | Week 2 | ZH-P1-036, ZH-P1-037 | E2E matrix passes for anonymous/client/provider/sugar roles |
| ZH-P1-041 | Story | P1-Alg-1 | Introduce conversion-focused ranking signals (view-to-chat, chat-to-booking) | BackendArchitect | database | Week 3 | Recommendation event tracking | Ranking metadata includes conversion signal and improves target conversion KPI |
| ZH-P1-042 | Task | P1-Alg-2 | Add anti-gaming guardrails for engagement signals | SecurityAuditor | BackendArchitect | Week 3 | ZH-P1-041 | Repeated synthetic interactions are dampened or excluded |
| ZH-P1-043 | Task | P1-Alg-3 | Add recommendation observability: supply diagnostics + fallback reasons dashboard API | BackendArchitect | DevOpsEngineer | Week 3 | Existing metadata outputs | Dashboard API exposes country supply, trust relaxation, and fallback rates |
| ZH-P1-044 | Task | P1-Alg-4 | Expand trust-event coverage for booking, messaging, cancellations, disputes | BackendArchitect | SecurityAuditor | Week 3 | TrustEngine integration | High-signal actions are recorded and reflected in trust score movement |
| ZH-P2-051 | Story | P2-Growth-1 | Add experimentation framework for recommendation weights by country | DevOpsEngineer | BackendArchitect | Week 4 | ZH-P1-041 | Runtime-configurable experiments with safe kill switch |
| ZH-P2-052 | Story | P2-Growth-2 | Add quality-tiered onboarding nudges for provider profile completeness | FrontendArchitect | BackendArchitect | Week 4 | Profile completeness service | Incomplete providers receive nudges and completion rate increases |
| ZH-P2-053 | Task | P2-Growth-3 | Add per-country liquidity strategy (radius expansion + scarcity messaging) | BackendArchitect | FrontendArchitect | Week 4 | ZH-P1-043 | Low-supply countries degrade gracefully with transparent UX messaging |
| ZH-P2-054 | Task | P2-Growth-4 | Build weekly reliability report pipeline (auth, contract, recommendation, realtime) | DevOpsEngineer | DebuggerAgent | Week 4 | Existing test gates | Weekly report generated automatically with trend deltas and regressions |

## Owner Legend
- BackendArchitect: API routes, business logic, middleware, recommendation services.
- FrontendArchitect: feed UI, navigation, state synchronization, responsive layout.
- database: MongoDB schema, query safety, indexing, data contracts.
- SecurityAuditor: role boundaries, privacy rules, anti-abuse controls.
- RealtimeEngineer: Socket lifecycle, unread state, messaging/call sync.
- DevOpsEngineer: test gates, CI pipelines, operational runbooks, observability.
- DebuggerAgent: root-cause validation, cross-file regression triage.

## Sprint Sequencing Rules
- Week 1 tickets are blocking for Week 2 UX exposure when they touch access/privacy.
- Week 2 UX tickets must have integration coverage before moving to done.
- Week 3 algorithm changes must ship behind runtime flags.
- Week 4 growth packs cannot bypass Week 1 contract and access gates.