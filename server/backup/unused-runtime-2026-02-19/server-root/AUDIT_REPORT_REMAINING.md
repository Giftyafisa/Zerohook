# Remaining service audits (appended as separate file)

### BitnobManager.js

- File: `server/services/BitnobManager.js`
- Purpose: Integration wrapper for Bitnob payment rails (crypto-fiat on/off ramps, wallet management).
- Connected files / callers:
  - `server/routes/payments.js`, `server/routes/transactions.js`, background reconciliation jobs

- Key exported methods:
  - initialize(), createInvoice(), verifyPayment(), createPayout(), getSupportedCurrencies(), isHealthy()

- Observed network/behavior:
  - Uses 3rd-party API endpoints, handles callback/webhook verification in route layer (confirm existence of signature verification), and performs address generation for crypto payouts.

- Risks & gaps:
  - Webhook idempotency and signature verification may be incomplete.
  - No consistent idempotency key handling for invoice creation.

- Recommendations:
  1. Add idempotency key support and store invoice attempts with a reference for reconciliation.
  2. Ensure webhook signature verification is implemented and test duplicate deliveries.
  3. Add monitoring for failed payout rates and reconcile via background job.

### CountryManager.js

- File: `server/services/CountryManager.js`
- Purpose: Central source for country metadata, validation, and localized defaults.
- Connected files / callers:
  - `server/routes/countries.js`, `server/routes/auth.js`, registration/profile flows, UI country pickers

- Key methods:
  - listCountries(), getCountryByCode(code), validateCountry(code), getDefaultLocale(countryCode)

- Observations:
  - Provides canonical country list and lookup helpers; some validation logic is duplicated in route code.

- Recommendations:
  1. Centralize all country validation through this manager and replace inline checks in routes.
 2. Publish a small JSON schema for country objects used by frontend.

### CryptoPaymentManager.js

- File: `server/services/CryptoPaymentManager.js`
- Purpose: Handles crypto-native payment flows (Ethereum/Polygon/Bitcoin interoperability, on-chain checks, confirmations).
- Connected files / callers:
  - `server/routes/payments.js`, `server/routes/escrow.js`, reconciliation jobs

- Key methods:
  - createPaymentIntent(chain, toAddress, amount, currency), verifyOnChainTransaction(txHash), monitorConfirmations(), createWithdrawal()

- Observed gaps:
  - Confirmation monitoring uses polling; consider event/websocket-based watchers for reliability.
  - Address reuse and nonce management need review (avoid accidental reuse on some chains).

- Recommendations:
  1. Implement robust nonce/address management and idempotency for payment intents.
 2. Add unit tests for conversion logic and confirmation thresholds per chain.
 3. Centralize error handling and bubble failed on-chain transactions into a reconciliation queue.

### PerformanceMetrics.js

- File: `server/services/PerformanceMetrics.js`
- Purpose: Collects and flushes performance metrics to DB/monitoring sinks (routes use middleware to emit metrics).
- Connected files / callers:
  - `server/middleware/performanceMonitoring.js`, `server/routes/*` via middleware injection

- Key behaviors:
  - Batches metrics into memory and flushes periodically or on thresholds; records to `performance_metrics` table.

- Risks & recommendations:
  1. Ensure in-memory buffers have size/time bounds to avoid memory pressure during spikes.
  2. Add circuit-breaker behavior if DB is down to avoid blocking request paths.
  3. Expose a lightweight health endpoint for the metrics service to indicate backlog and last flush time.

### PrivacyManager.js

- File: `server/services/PrivacyManager.js`
- Purpose: Enforces privacy rules (profile visibility, PII redaction, data export/erasure helpers).
- Connected files / callers:
  - `server/routes/privacy.js`, `server/routes/users.js`, profile endpoints, notification payload builders

- Key behaviors:
  - Evaluates privacy tier rules, redact fields before returning payloads, manage data-export and deletion flows.

- Risks & recommendations:
  1. Add comprehensive tests for PII redaction rules and default privacy tiers.
  2. Ensure export/deletion flows are transactional and logged for auditability.
  3. Provide a shared helper used by notifications and search to avoid leaks in ancillary payloads.

### SystemHealthService.js

- File: `server/services/SystemHealthService.js`
- Purpose: Aggregates health checks for DB, external APIs, payment providers, and background workers.
- Connected files / callers:
  - `server/routes/status.js`, `server/routes/dashboard.js`, monitoring/alerting systems

- Key behaviors:
  - Runs connectivity checks and returns an aggregated status object (uptime, lastSuccessfulCheck, component statuses).

- Recommendations:
  1. Ensure checks are non-blocking and cached (do not run a full external API probe on every status request).
  2. Surface detailed component statuses for Prometheus/monitoring ingestion.
  3. Add alert thresholds and integrate with existing monitoring/incident systems.

### UserActivityMonitor.js

- File: `server/services/UserActivityMonitor.js`
- Purpose: Tracks high-level user activity for analytics and security (DAU/MAU, suspicious activity patterns).
- Connected files / callers:
  - Performance middleware, monitoring dashboards, security jobs, `fraudDetection` for behavioral signals

- Observations & recommendations:
  1. Buffer and batch writes to avoid overwhelming the DB on spikes (use Kafka/Redis streams if needed for scale).
  2. Document event schemas and TTLs; ensure PII minimization in analytics tables.

### VerificationManager.js

- File: `server/services/VerificationManager.js`
- Purpose: Orchestrates identity verification flows (phone/SMS OTP, email, gov-id upload, biometric checks, third-party ID providers).
- Connected files / callers:
  - `server/routes/verification.js`, `server/routes/auth.js`, `TrustEngine.js`

- Key methods:
  - initiateVerification(userId, method, payload), verifyCode(userId, code, method), uploadDocument(userId, doc), getVerificationStatus(userId)

- Observed gaps:
  - Several verification helpers in TrustEngine are stubbed; this module should centralize provider integrations and result normalization.

- Recommendations:
  1. Normalize verification results into a small enum and record audit trails for each attempt.
  2. Centralize retries, rate limits, and PII handling for uploaded documents.
  3. Add strong logging and admin endpoints for manual appeal/reviews.

---

Notes on next steps:
- The remaining service audits have been saved to this file to avoid patch conflicts when appending to `AUDIT_REPORT.md`.
- Next immediate action I can take: safely append this file's contents into `server/AUDIT_REPORT.md` in smaller, validated edits (one section at a time), or create a PR that consolidates the audit files into the main report. Let me know which you prefer.
