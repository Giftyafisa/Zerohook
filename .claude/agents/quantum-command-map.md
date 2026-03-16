# Zerohook Quantum Command Orchestration Map

This file defines deterministic command routing for ZH-Nexus and all specialist agents.
It is contract-first: command execution order, ownership, and verification are explicit.

## 1) Global Execution Contract

For any command:

1. Parse intent and constraints.
2. Identify primary specialist owner.
3. Identify supporting specialists (if any).
4. Execute invariant checks before code edits when risk is medium/high.
5. Apply minimal complete change.
6. Run command-specific verification matrix.
7. Emit decision trace, evidence, and residual risk.

## 2) Mother Command Router (/q-*)

| Command | Primary Owner | Supporting Owners | Required Verification |
|---|---|---|---|
| /q-audit | SecurityAuditor | BackendArchitect, FrontendArchitect, database, RealtimeEngineer | Vulnerability inventory + contract consistency |
| /q-search | DebuggerAgent | Domain-specific owner by hit surface | Hit relevance + false-positive filter |
| /q-fix | Domain owner by Hilbert score | DebuggerAgent when uncertainty high | Root-cause evidence + regression checks |
| /q-refactor | Domain owner | DevOpsEngineer for rollout safety | API/behavior parity + performance sanity |
| /q-optimize | DevOpsEngineer | Domain owner | Before/after metric delta |
| /q-trace | DebuggerAgent | Domain owner | End-to-end causal chain coverage |
| /q-phase | Mother | None | QSS scoring with rationale |
| /q-hilbert | Mother | None | Weighted routing output |
| /q-uiprobe | FrontendArchitect | DevOpsEngineer | Breakpoint/state matrix pass/fail |
| /q-contractmesh | BackendArchitect | FrontendArchitect, database, RealtimeEngineer | Producer/consumer contract parity |
| /q-retrospect | Mother | All touched specialists | Lessons + mandatory check updates |
| /q-proof | Domain owner | SecurityAuditor for sensitive paths | Invariant proof/test evidence |
| /q-modelcheck | DebuggerAgent | Domain owner | State/property check results |
| /q-belief | DebuggerAgent | Domain owner | Posterior ranking with evidence sources |
| /q-causal | DebuggerAgent | Domain owner | Causal graph and root node confidence |
| /q-sim | Domain owner | DevOpsEngineer | Counterfactual outcomes comparison |
| /q-redteam | SecurityAuditor | Domain owner | Attack path results + mitigations |
| /q-twin | DevOpsEngineer | Domain owner | Twin scenario outcomes and risk shift |
| /q-optimal | Mother | Domain owner | Multi-objective utility comparison |
| /q-guard | SecurityAuditor | Domain owner | Safety guard coverage |
| /q-arbitrate | Mother | Conflicting specialists | Evidence packet tie-break record |
| /q-neurosym | Mother | Domain owner | Symbolic/probabilistic fusion decision |
| /q-temporal | Domain owner | DebuggerAgent | Temporal property validation |
| /q-drift | DevOpsEngineer | Domain owner | Drift severity and compatibility plan |
| /q-experiment | DebuggerAgent | Domain owner | Minimum discriminative experiment result |
| /q-debate | Mother | Relevant specialists | Builder/Breaker/Verifier summary |
| /q-govern | Mother | DevOpsEngineer, SecurityAuditor | Policy update and enforcement plan |
| /q-entropy | DebuggerAgent | None | Uncertainty heatmap and next evidence step |
| /q-calibrate | Mother | Domain owner | Confidence calibration report |

## 3) Specialist Command Router

### BackendArchitect (/b-*)

- /b-trace, /b-contract, /b-migrate, /b-harden, /b-risk
- /b-proof, /b-sim, /b-belief, /b-redteam, /b-twin
- /b-neurosym, /b-temporal, /b-drift, /b-debate

### FrontendArchitect (/f-*)

- /f-uiprobe, /f-trace, /f-a11y, /f-stabilize, /f-ux
- /f-proof, /f-sim, /f-belief, /f-redteam, /f-twin
- /f-neurosym, /f-temporal, /f-drift, /f-debate

### database (/d-*)

- /d-trace, /d-index, /d-migrate, /d-integrity, /d-risk
- /d-proof, /d-sim, /d-belief, /d-redteam, /d-twin
- /d-neurosym, /d-temporal, /d-drift, /d-debate

### SecurityAuditor (/s-*)

- /s-audit, /s-auth, /s-hardening, /s-abuse, /s-risk
- /s-proof, /s-sim, /s-belief, /s-redteam, /s-twin
- /s-neurosym, /s-temporal, /s-drift, /s-debate

### RealtimeEngineer (/r-*)

- /r-trace, /r-presence, /r-rooms, /r-stabilize, /r-delivery
- /r-proof, /r-sim, /r-belief, /r-redteam, /r-twin
- /r-neurosym, /r-temporal, /r-drift, /r-debate

### DevOpsEngineer (/o-*)

- /o-health, /o-drift, /o-risk, /o-observe, /o-smoke
- /o-proof, /o-sim, /o-belief, /o-redteam, /o-twin
- /o-neurosym, /o-temporal, /o-drift, /o-debate

### DebuggerAgent (/g-*)

- /g-trace, /g-hypothesis, /g-verify, /g-fixloop, /g-postmortem
- /g-proof, /g-sim, /g-belief, /g-redteam, /g-twin
- /g-neurosym, /g-temporal, /g-drift, /g-debate

## 4) Handoff and Arbitration Rules

1. Each command has exactly one primary owner.
2. Supporting owners supply evidence packets, not parallel conflicting edits.
3. If specialists disagree, invoke /q-arbitrate before implementation.
4. High-risk work requires /q-proof or specialist proof command before completion.

## 5) Completion Packet Schema

Every command completion should output:

- command and owner
- decision summary
- alternatives considered
- verification evidence
- residual risk
- entangled files/surfaces to monitor
