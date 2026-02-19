  2. Add content moderation hooks to `POST /send` to call `FraudDetection.analyzeMessageRisk` and optionally block or flag messages.
  3. Add tests for socket emission paths and ensure test harness joins rooms similarly to client behavior.

### server/routes/escrow.js — Detailed Audit

- File: `server/routes/escrow.js`
- Purpose: Creates escrows, confirms completion, initiates disputes, and retrieves escrow status.
- Connected services/files:
  - `server/services/EscrowManager.js` (core escrow orchestration)
  - `server/services/TrustEngine.js` (assessTransactionRisk used before creating escrows)
  - `server/services/PaystackManager.js`, `server/services/CryptoPaymentManager.js` (payment execution)
  - `server/config/database` (DB queries used for access checks)

- Key endpoints/behaviors:
  - POST /api/escrow/create: assesses risk, delegates to `req.escrowManager.createEscrow`
  - POST /api/escrow/:id/complete: verifies participant, delegates to `req.escrowManager.confirmCompletion`
  - POST /api/escrow/:id/dispute: delegates to `req.escrowManager.initiateDispute`
  - GET /api/escrow/:id/status: access check then `req.escrowManager.getEscrowStatus`

- Observed issues & risks:
  1. Risk gating via `TrustEngine.assessTransactionRisk` is present — ensure consistent thresholds and centralized config for risk levels.
 2. `create` delegates heavy logic to `EscrowManager` which is good for separation. Ensure `EscrowManager.createEscrow` performs idempotency checks for duplicate requests.
 3. Access checks inline use `query()` in some handlers (e.g., confirm completion/status); consider moving access validation into a shared helper or into `EscrowManager` for consistent authorization logic.
 4. Error handling returns raw `error.message` in some responses — avoid leaking internal errors in production; use environment-aware messages.

- Quick fixes / recommendations:
  1. Add idempotency keys to escrow creation requests and persist them to prevent duplicate escrows for the same intent.
 2. Move access validation into `EscrowManager` where appropriate and centralize error handling to produce consistent API error shapes.
 3. Ensure `EscrowManager` integrates with payment providers with proper retry/backoff and idempotency handling on network errors.
 4. Add integration tests for escrow creation → payment capture → completion and dispute flows, including high-risk gating scenarios.

  5. Add tests for profile update merging behavior to ensure updates don't accidentally overwrite nested fields.

### server/routes/chat.js — Detailed Audit

- File: `server/routes/chat.js`
- Purpose: Chat, messaging, conversation management, video call signaling, blocking, and message CRUD.
- Connected services/files:
  - `server/services/UserConnectionManager.js` (contact requests / conversation creation overlaps)
  - `server/services/NotificationManager` or notifications table (inserts for contact/invite flows)
  - `server/config/database` (DB queries via `query`)
  - Socket.io integration via `req.io` for real-time delivery

- Key endpoints/behaviors:
  - GET /api/chat/conversations: returns user conversations and participant metadata
  - GET /api/chat/messages/:conversationId: verifies membership and returns messages
  - POST /api/chat/send: validation, insert message, update conversation, emit via socket.io
  - POST /api/chat/conversation: create or get existing conversation
  - POST /api/chat/read/:conversationId: mark unread messages as read
  - POST /api/chat/video-call: emit video call events to conversation room
  - POST /api/chat/block-user: insert into `blocked_users` and update conversation status
  - DELETE /api/chat/conversation/:conversationId: soft-delete conversation

- Observed issues & risks:
  1. Conversation creation and messaging logic is duplicated across `UserConnectionManager` and chat routes — centralize conversation creation logic.
 2. Emission to socket.io assumes `req.io` is available and that users join conversation rooms; ensure socket connection middleware adds users to `user_{id}` and `conversation_{id}` rooms reliably.
 3. Message insertion and conversation update are separate DB writes; under concurrency this could lead to inconsistent `last_message_time` — wrap in a transaction or use `RETURNING` to atomically update conversation with message data.
 4. `blocked_users` insertion uses ON CONFLICT which is good; ensure blocked user checks are enforced in message send and conversation fetch logic elsewhere.
 5. No server-side content moderation/filtering on messages — `req.fraudDetection.analyzeMessageRisk` was not observed here; consider integrating message risk checks for forbidden content or attachments.

- Quick fixes / recommendations:
  1. Extract conversation & message creation into a `ConversationManager` service used by both chat and connection flows.
 2. Wrap message insert + conversation update in a DB transaction to avoid race conditions for `last_message_time` and `last_message`.
 3. Add content moderation hooks to `POST /send` to call `FraudDetection.analyzeMessageRisk` and optionally block or flag messages.
 4. Add tests for socket emission paths and ensure test harness joins rooms similarly to client behavior.

---

NOTE: The detailed chat system dry-audit was expanded into `server/AUDIT_CHAT_SYSTEM.md` and merged (summary) here on 2025-09-29. Changes implemented following that audit:

- Added socket.io handshake JWT middleware to validate tokens and attach `socket.userId` and `socket.username`.
- Made REST `POST /api/chat/send` and socket `send_message` transactional and integrated `FraudDetection.analyzeMessageRisk` moderation checks.
- Added `server/services/ConversationService.js` to centralize membership checks, blocked-user checks, and transactional message insertion. Routes and socket handlers refactored to use this service.
- Created `server/AUDIT_CHAT_SYSTEM.md` for the full per-file chat-system audit and remediation plan.


---

# Full Chat System Dry Audit (Appended)

_This section is a verbatim copy of `server/AUDIT_CHAT_SYSTEM.md` as of 2025-09-29 for full traceability._

# Chat System Dry Audit

Generated: 2025-09-29

Scope: server-side chat system (REST routes, socket handlers, DB tables, and services used to support chat: FraudDetection, UserActivityMonitor, UserConnectionManager, notifications, user_sessions, blocked_users).

Goal: For each primary file in the chat sector, list: purpose, public API (routes/events), dependencies (files/services/tables), observed issues, and concrete remediation recommendations. Also list dependent files and ensure each dependent file is auditable as a primary subject.

-- Summary --

Primary chat files inspected:
- `server/routes/chat.js` (REST endpoints for conversations/messages/video calls/blocks)
- `server/index.js` (socket.io initialization and socket event handlers)
- `server/config/database.js` (pool, `query()`, `getClient()`, table initialization)
- `server/services/FraudDetection.js` (message moderation and fraud analysis)
- `server/services/UserActivityMonitor.js` (sessions, presence, activity logging)
- `server/services/UserConnectionManager.js` (connections, contact requests, block logic)
- `server/setup-database.js` (table DDL for conversations, messages, blocked_users, user_sessions)

Database tables directly used by chat:
- `conversations`, `messages`, `blocked_users`, `user_sessions`, `user_presence`, `user_activity_logs`, `notifications`.

Audit rule enforced: when a file is audited as primary, every file it communicates with is listed and audited as a dependent. Every dependent is also auditable as a primary.

--- Per-file audits ---

1) server/routes/chat.js (primary)
- Purpose: REST endpoints to list conversations, fetch messages, send messages, create conversations, mark read, start/join video calls, block users, delete conversations.
- Public API:
  - GET /api/chat/conversations
  - GET /api/chat/messages/:conversationId
  - POST /api/chat/send
  - POST /api/chat/conversation
  - POST /api/chat/read/:conversationId
  - POST /api/chat/video-call
  - POST /api/chat/block-user
  - DELETE /api/chat/conversation/:conversationId
- Dependencies:
  - `authMiddleware` (from `server/routes/auth.js`) for private access.
  - `server/config/database.js` (`query()`)
  - `server/services/FraudDetection.js` via `req.fraudDetection` (moderation)
  - `server/services/UserActivityMonitor.js` via `req.userActivityMonitor` (logging)
  - `server/index.js` for `req.io` (socket emits) — two-way dependency: routes emit to sockets; sockets and routes must agree on room names.
  - DB tables: `conversations`, `messages`, `blocked_users`.
- Observations & issues:
  - POST /api/chat/send originally did INSERT then UPDATE without transaction — now updated to use `getClient()` and a DB transaction. Good.
  - No consistent use of content moderation previously; changed to call `req.fraudDetection.analyzeMessageRisk` before commit.
  - Emission to `req.io` assumes clients are in `conversation_{id}` rooms. Socket handlers must reliably join rooms; that was missing but updated in `server/index.js`.
  - Some queries assemble JSON incorrectly (ensure JSON.stringify used for metadata consistently).
- Recommendations:
  - Keep the transactional flow (insert + update + commit) and emit after commit.
  - Standardize message metadata shape (object with keys: attachments[], mentions[], forwardedFrom?) and add JSON schema validation.
  - Add unit tests that call POST /api/chat/send with mocked `FraudDetection` to test blocking and allowed paths.

2) server/index.js (primary)
- Purpose: Express server bootstrap, socket.io server, service initialization, and socket event handlers for activity, typing, calls, and chat events.
- Public surface: socket events (connection, typing_start/stop, join_conversation, send_message, call_request/accept/reject/end, heartbeat, user_activity, update_status, get_user_status).
- Dependencies:
  - `server/services/*` (TrustEngine, FraudDetection, UserActivityMonitor, UserConnectionManager, EscrowManager, etc.) injected in middleware into req for REST, accessible by top-level handlers.
  - `server/config/database.js` (getClient for socket flows)
  - `server/routes/chat.js` (routes mounted at `/api/chat`)
  - DB tables used in socket handlers: `conversations`, `messages`, `user_sessions`, `blocked_users`, `user_presence`.
- Observations & issues:
  - Socket authentication: previously missing; we added `io.use(...)` JWT handshake middleware that sets `socket.userId` and `socket.username` — critical fix.
  - `join_conversation` and `send_message` socket handlers previously trusted clients and did not check DB membership or blocked status; now both checks are in place using `getClient()`.
  - Socket `send_message` originally broadcast-only and non-persistent; now it persists in a transaction and emits after commit. This aligns REST and socket flows.
  - Some socket handlers use `Date.now().toString()` for IDs (temp); production should rely on DB-generated UUIDs returned from INSERT.
  - Potential performance: joining many conversation rooms or frequent DB checks on join/send could create DB load; consider caching membership checks in Redis with TTL.
- Recommendations:
  - Keep `io.use` middleware and ensure client sends JWT in `socket.handshake.auth.token`.
  - Replace temporary ID generation with DB UUIDs when persisting messages; for optimistic immediate UI updates use a client-provided temporary ID that is reconciled after server ACK (include both tempId and real id in emission).
  - Add caching layer (Redis) for conversation membership and blocked checks to reduce DB roundtrips.
  - Add timeouts and circuit-breaker for `fraudDetection.analyzeMessageRisk` to avoid blocking the socket path on slow analysis.

3) server/config/database.js (primary)
- Purpose: PG Pool, Redis client, `connectDB()`, `connectRedis()`, `query(text, params)`, `getClient()` helper, and schema initialization.
- Dependencies: Postgres environment, `setup-database.js` DDL.
- Observations & issues:
  - `query()` has retry logic for transient connection errors — good.
  - `getClient()` exists and is used to implement transactions in REST and socket flows.
  - Schema initialization creates chat tables; `messages` table has `metadata` in some places, ensure it's present in DDL (it is in `setup-database.js` variants).
- Recommendations:
  - Ensure DDL has `metadata JSONB` column on `messages` (some files used `metadata`, ensure consistent schema).
  - Consider prepared statements for high-frequency queries (membership checks) to gain performance.

4) server/services/FraudDetection.js (primary)
- Purpose: Central fraud detection and message moderation engine. Exposes `analyzeFraudRisk` and `analyzeMessageRisk` used by REST and socket flows.
- Dependencies: DB (via `query()`), configured fraud patterns and thresholds.
- Observations & issues:
  - `analyzeMessageRisk` inspects content for urgency words, suspicious payment terms, contact information, and length — solid rule-based checks.
  - Returns a `score` and `factors`. REST and socket flows use `score` to decide blocking (we used `0.7` threshold by default).
  - Potential false positives: rules like `contactPatterns` will flag legitimate messages with short phone-like strings; tuning and tests needed.
- Recommendations:
  - Add unit tests and sample messages dataset to validate false-positive rate.
  - Add a short-circuit path when `analyzeMessageRisk` fails (we already log and proceed), but prefer failing-open with background review.
  - Consider asynchronous moderation for lower-latency paths: accept message, persist, deliver, then run moderation and retract/flag later if needed (tradeoff between UX and safety).

5) server/services/UserActivityMonitor.js (primary)
- Purpose: Session management, presence, activity logging, typing status, and user metrics.
- Observations & issues:
  - Maintains in-memory map of sessions (fine for small scale) and persists session rows in DB.
  - createUserSession returns `sessionToken` and updates `user_presence` — used by socket connection flow.
  - Potential scalability: in-memory `activeSessions` won't scale across processes; rely on Redis for distributed sessions.
- Recommendations:
  - Replace or complement in-memory session tracking with Redis for multi-process deployments.
  - Add TTL on Redis keys for sessions and presence, and use pub/sub to synchronize presence across instances.

6) server/services/UserConnectionManager.js (primary)
- Purpose: Manage contact requests, connections, blocking, and helper flows that create conversations when a contact is accepted.
- Observations & issues:
  - Implements blockUser and inserts into `blocked_users`, closes conversations, rejects pending requests — good centralized block logic.
  - Many DB queries executed inline; consider grouping multi-statement flows in transactions where needed (e.g., create conversation + welcome message should be transactional).
- Recommendations:
  - Wrap `respondToContactRequest` (accept path) in a transaction to avoid partial states (e.g., conversation created but message insertion fails).
  - Expose helper methods for conversation membership checks to avoid duplicate SQL across files.

7) server/setup-database.js (primary)
- Purpose: Contains DDL used to create `conversations`, `messages`, `blocked_users`, `user_sessions`, and indexes.
- Observations & issues:
  - `conversations` DDL contains `status` and unique participant pair constraint — good.
  - `messages` table in main `database.js` variant is created without `metadata` column; `setup-database.js` has some variants that include `metadata`. Ensure consistent DDL across init scripts.
- Recommendations:
  - Consolidate DDL into one canonical migration script (use a migrations tool like Flyway/Knex/pg-migrate) and ensure `metadata JSONB` is present.

--- Dependency map (chat primary -> dependents) ---
- `server/routes/chat.js` -> `server/config/database.js`, `server/routes/auth.js` (authMiddleware), `server/services/FraudDetection.js`, `server/services/UserActivityMonitor.js`, `server/index.js` (io emit)
- `server/index.js` (socket) -> `server/config/database.js`, `server/services/FraudDetection.js`, `server/services/UserActivityMonitor.js`, `server/services/UserConnectionManager.js`
- Services themselves depend on `query()` from `server/config/database.js` and the DB tables in `setup-database.js`.

--- Cross-file auditing notes (enforce the 'auditable as primary when dependent' rule) ---
- Each dependent service file (`FraudDetection.js`, `UserActivityMonitor.js`, `UserConnectionManager.js`) was reviewed above and includes its own dependencies and recommendations. They are auditable as primaries and as secondaries to the route/socket code.

--- Concrete remediation plan (prioritized) ---
1. High priority (security/correctness):
  - Keep `io.use` JWT handshake and ensure production `JWT_SECRET` is set.
  - Keep message moderation check and transactional persistence for both REST (`/api/chat/send`) and socket (`send_message`) flows.
  - Ensure `blocked_users` checks occur in all message paths (REST and socket) and when creating/joining conversations.

2. Medium priority (consistency & maintainability):
  - Consolidate DDL and add a migration system. Verify `messages` has `metadata JSONB` across all init paths.
  - Add shared helpers: `conversationService.isMember(conversationId, userId)` and `conversationService.isBlockedBetween(userA, userB)` to avoid duplicate SQL.
  - Replace ad-hoc ID generation with DB UUIDs and support optimistic UI updates via temporary client IDs.

3. Low priority (scale & performance):
  - Cache membership and blocked checks in Redis with short TTL.
  - Move in-memory session tracking to Redis (for multi-instance scaling).
  - Add circuit-breaker/timeouts around `FraudDetection` analysis; consider async moderation and later retraction for low-latency UX.

--- Tests recommended ---
- Unit tests for `FraudDetection.analyzeMessageRisk` with a test dataset (happy + edge + known false positives).
- Integration tests for REST and socket flows:
  - Socket connect with valid JWT sets `socket.userId`.
  - `join_conversation` allowed for member, forbidden for others.
  - `send_message` persists message and emits to the room; blocked message returns `message_blocked`.
  - Concurrency tests: multiple messages inserted concurrently to the same conversation update `last_message_time` correctly.

--- Follow-ups & next steps ---
1. I can produce an automated PR that:
  - Adds the shared helper `server/services/ConversationService.js` with membership and block checks and small unit tests.
  - Adds caching layer usage (Redis) for membership checks.
  - Converts temporary message ID usage in socket handlers to rely on DB UUIDs.
2. If you want, I can merge `server/AUDIT_CHAT_SYSTEM.md` into `server/AUDIT_REPORT.md` or open a PR containing both files.

This audit focused on the server-side chat stack. If you'd like, I can continue by auditing the client-side chat code (client/src) to ensure the client uses the JWT handshake correctly, uses optimistic UI updates with temp ids, and properly joins `conversation_{id}` rooms after fetching conversation info.

--- End of Chat System Audit ---

  5. Add tests for JSON parsing safety, and ensure `profile_data` and `media_urls` are validated upon insertion to avoid malformed data.

### server/routes/users.js — Detailed Audit

- File: `server/routes/users.js`
- Purpose: User profile CRUD, browsing/search, profile detail retrieval, and updates.
- Connected services/files:
  - `server/services/PrivacyManager.js` (privacy enforcement expectations)
  - `server/services/TrustEngine.js` (trust/reputation fields used in filters)
  - `server/services/FraudDetection.js` (used in auth flows that create users)
  - `server/config/database` (DB queries via `query`)

- Key endpoints/behaviors:
  - GET /api/users/profile: authenticated profile retrieval
  - PUT /api/users/profile: profile update merging JSONB via COALESCE and concatenation
  - GET /api/users/profiles: public browsing with complex JSONB-based filters and pagination
  - GET /api/users/:id: public user profile retrieval with validation

- Observed issues & risks:
  1. `profiles` endpoint builds a complex dynamic WHERE clause against `profile_data` JSONB. This is powerful but fragile; ensure indices (GIN) exist for commonly queried JSONB paths to avoid table scans.
 2. The `profiles` endpoint attempts to decode the Authorization header manually to exclude the current user; reuse of `authMiddleware` or a lighter token check helper would reduce duplication.
 3. The code filters for `u.profile_data ? 'firstName'` etc., then later again filters validProfiles in JS—this duplication of validation could be consolidated server-side.
 4. Pagination math for `pages` uses enhancedProfiles.length which is the length of the returned page, not total results — this will misreport total pages; consider using the earlier `totalCount` or returning total across all filters.
 5. Putting email in public profile lists (`SELECT ... u.email`) may expose emails to unauthenticated callers; consider redaction or conditional fields for public APIs unless intentional.

- DB queries observed:
  - SELECT id, username, email, verification_tier, reputation_score, profile_data ... FROM users WHERE id = $1
  - UPDATE users SET profile_data = COALESCE(profile_data, '{}') || $1 WHERE id = $2
  - COUNT and SELECT queries over users with JSONB filters using `->` and `->>` operators

- Quick fixes / recommendations:
  1. Add GIN indexes for JSONB paths used frequently (e.g., profile_data->'location', profile_data->>'age', profile_data->'serviceCategories').
 2. Use `authMiddleware` or a lightweight token checker helper to consistently extract current user ID rather than re-parsing tokens inline.
 3. Return `total` counts and compute `pages` server-side using the stored `totalCount` instead of page length.
 4. Consider redacting or omitting `email` from public profile lists unless explicitly allowed by privacy settings.
 5. Add tests for profile update merging behavior to ensure updates don't accidentally overwrite nested fields.

- Quick fixes / recommendations:
  1. Remove/guard mock authentication paths behind an environment flag (e.g., NODE_ENV === 'test') and ensure test credentials are not exposed in production builds.
  2. Move business logic into `server/services/AuthService.js` to centralize DB access, validation, and trust/fraud orchestration (this also eases unit testing).
  3. Add server-side token revocation support (token blacklist stored in Redis) for high-security flows (suspicious accounts, suspension, manual logout required).
  4. Replace RateLimiterMemory with a distributed rate limiter (Redis-backed) to support multiple instances.
  5. Add integration tests for fraud gating paths (blocked registration/login), verification tier upgrades, and token refresh/validation.

### server/routes/services.js — Detailed Audit

- File: `server/routes/services.js`
- Purpose: Service listing, creation, retrieval, categories, and provider-specific service queries.
- Connected services/files:
  - `server/services/AdultServiceManager.js` (some overlap; routes currently implement business logic inline)
  - `server/services/TrustEngine.js` and `server/services/FraudDetection.js` for gating and risk checks (routes call these in some flows elsewhere)
  - `server/config/database` (DB queries via `query`)

- Key endpoints/behaviors:
  - GET /api/services: supports category, price, location filters, pagination; dynamic SQL building
  - GET /api/services/categories: returns service category metadata
  - GET /api/services/user-services: returns services for the authenticated provider
  - GET /api/services/:id: validates UUID, formats service object for frontend, increments views
  - POST /api/services: authenticated service creation with inline validation and DB insertion

- Observed issues & risks:
  1. Dynamic SQL building uses manual param index management (prone to off-by-one or injection if modified). Consider using a query builder or helper to keep indexes correct.
 2. Inline business logic duplicates functionality present in `AdultServiceManager.js` — extract to service manager to avoid divergence.
 3. `GET /:id` parses JSON fields (media_urls, requirements, profile_data) with try/catch, but inconsistent shapes in DB may cause runtime errors; consider centralizing formatting and adding defensive validation.
 4. Pagination `hasMore` uses equality against limit which may be misleading when total results < limit; compute hasMore via a count or by fetching limit+1 rows.
 5. UUID validation is present (good) but does not return consistent error shape with other endpoints.

- DB queries observed:
  - Complex SELECT joining `services`, `service_categories`, and `users` with dynamic WHERE clause
  - INSERT INTO services (...) VALUES (...) RETURNING *
  - UPDATE services SET views = views + 1 WHERE id = $1

- Quick fixes / recommendations:
  1. Extract create/list/get logic into `server/services/ServiceManager.js` or use the existing `AdultServiceManager.js` for adult-specific logic.
 2. Replace manual param indexing with a small helper that builds parameter arrays and placeholders, or use a query builder like Knex for safety and readability.
 3. Standardize service response formatting in a single helper used by `GET /:id` and other endpoints; document the expected frontend service object shape.
 4. Use COUNT or fetch limit+1 to calculate `hasMore` correctly and avoid expensive COUNT for every request (or cache counts per category).
 5. Add tests for JSON parsing safety, and ensure `profile_data` and `media_urls` are validated upon insertion to avoid malformed data.

---

## Route audits: high-priority routes (appended)

### server/routes/auth.js — Detailed Audit

- File: `server/routes/auth.js`
- Purpose: Authentication endpoints: register, login (including mock fallback), verify-tier, refresh, logout, token validation.
- Connected services/files:
  - `server/services/FraudDetection.js` (calls `req.fraudDetection.analyzeFraudRisk` on register/login)
  - `server/services/TrustEngine.js` (calls `req.trustEngine.recordTrustEvent` and `verifyIdentity`)
  - `server/services/VerificationManager.js` (verify-tier orchestration)
  - `server/config/database` (DB queries via `query`)
  - `server/routes/*` which rely on JWT payloads and verification-tier fields

- Key functions/endpoints:
  - POST /api/auth/register: input validation, fraud check, create user, record trust event, issue JWT
  - POST /api/auth/login: supports mock auth when DB unavailable; standard DB auth with password compare; fraud check; record trust event; issue JWT
  - POST /api/auth/verify-tier: calls `req.trustEngine.verifyIdentity` and upgrades tier
  - POST /api/auth/refresh: refreshes JWT with fresh DB values
  - POST /api/auth/logout: client-side token invalidation (no server blacklist)
  - POST /api/auth/validate-token: verifies JWT & user status

- Observed behaviors & risks:
  1. Mock authentication mode for tests is present in production code — this is a security risk if left enabled. There are explicit DB-fallback messages guiding use of the test credential.
 2. Token issuance includes `verificationTier` which is used across routes for gating — good for feature gating but ensure token refresh after verification changes.
 3. No server-side token revocation/blacklist implemented — logout is client-only.
 4. Rate-limiting is configured for auth endpoints (RateLimiterMemory) which is good but memory-based limiter won't work across multiple server instances; consider Redis-backed limiter for clustered deployment.
 5. Inline DB logic is mixed with business logic — consider extracting to `AuthService` for testability and reuse.

- DB queries observed:
  - SELECT id FROM users WHERE email = $1 OR username = $2
  - INSERT INTO users (username, email, password_hash, phone, verification_tier, profile_data) ... RETURNING id, username, email, verification_tier, reputation_score, trust_score, created_at
  - SELECT ... FROM users WHERE email = $1 (login)
  - UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = $1
  - SELECT verification_tier FROM users WHERE id = $1
  - SELECT id, username, verification_tier, is_subscribed, subscription_tier, subscription_expires_at, profile_data FROM users WHERE id = $1 (refresh/validate)

- Quick fixes / recommendations:
  1. Remove/guard mock authentication paths behind an environment flag (e.g., NODE_ENV === 'test') and ensure test credentials are not exposed in production builds.
  2. Move business logic into `server/services/AuthService.js` to centralize DB access, validation, and trust/fraud orchestration (this also eases unit testing).
  3. Add server-side token revocation support (token blacklist stored in Redis) for high-security flows (suspicious accounts, suspension, manual logout required).
  4. Replace RateLimiterMemory with a distributed rate limiter (Redis-backed) to support multiple instances.
  5. Add integration tests for fraud gating paths (blocked registration/login), verification tier upgrades, and token refresh/validation.

# Server Sector Audit Report

## TrustEngine.js

### FraudDetection.js — Detailed Audit

- File: `server/services/FraudDetection.js`
- Purpose: Central engine for detecting and scoring fraud risk across user actions (registration, login, service creation, bookings, messaging, profile updates).
- Connected files / callers:
  - `server/routes/auth.js` (registration/login/verification flows call `analyzeFraudRisk`)
  - `server/routes/services.js` and `server/routes/adultServices.js` (service creation checks)
  - `server/routes/transactions.js` and `server/routes/escrow.js` (booking/request risk analysis)
  - `server/routes/chat.js` (message content analysis)
  - Any admin/manual-review endpoints, monitoring dashboards, TrustEngine (consumers of fraud logs or risk alerts)

- Key exported class & methods:
  - FraudDetection (class)
  - initialize(), isHealthy()
  - analyzeFraudRisk(userId, actionType, actionData, context)
  - analyzeMessageRisk(messageData)
  - analyzeRegistrationRisk(registrationData, context)
  - analyzeServiceCreationRisk(userId, serviceData, user)
  - analyzeBookingRisk(userId, bookingData, user)
  - analyzeLoginRisk(userId, actionData, context)
  - analyzeProfileUpdateRisk(userId, updateData, user)
  - getUserProfile(), getMarketPrice(), checkIPReputation()
  - checkFraudPatterns(), analyzeBehavioralAnomalies(), analyzeNetworkConnections()
  - logFraudAnalysis(userId, actionType, analysisResult)

- Database queries observed:
  - SELECT * FROM users WHERE id = $1 (getUserProfile)
  - SELECT COUNT(*) FROM users JOIN user_sessions ... WHERE s.ip_address = $1 AND u.created_at > NOW() - INTERVAL '24 hours' (registration rapid-create detection)
  - SELECT AVG(price) FROM services ... (market price for category/duration)
  - SELECT COUNT(*) FROM services WHERE provider_id = $1 AND created_at > NOW() - INTERVAL '24 hours' (excessive service creation)
  - SELECT COUNT(*) FROM transactions WHERE client_id = $1 AND created_at > NOW() - INTERVAL '1 hour' (rapid bookings)
  - SELECT COUNT(*) FROM trust_events WHERE user_id = $1 AND event_type = 'login_failed' ... (failed logins)
  - INSERT INTO fraud_logs (...) VALUES (...) (logging analysis results)

- Stubbed/external integrations and gaps (production risk):
  - IP reputation: `checkIPReputation` currently mocks results; should integrate AbuseIPDB / VirusTotal / commercial IP reputation services.
  - Behavioral / ML models: `analyzeBehavioralAnomalies`, `analyzeNetworkConnections`, `checkFraudPatterns` are placeholders. In production these should be backed by trained models, feature stores, or rules engines.
  - Market price calculation assumes well-formed category/duration; consider canonicalization and caching of market statistics.

- Notable behaviors & safety nets:
  - analyzeFraudRisk composes multiple analyzers, normalizes scores to 0-1, and logs results to `fraud_logs` for auditability.
  - The function returns a structured object: { riskScore, riskLevel, riskFactors, recommendation, shouldBlock, requiresVerification } — suitable for programmatic gating in routes.
  - On internal error, the service returns a safe default (riskScore: 0.5, medium) to force manual review/verification rather than silently allowing risky actions.

- Duplication / coupling risks:
  - Some risk checks overlap with `TrustEngine.assessTransactionRisk` (e.g., low trust, verification tier checks). This can cause inconsistent behavior if rules drift.
  - Inline checks in route files (quick filters) may duplicate logic; centralize checks here and call from routes for consistent outcomes.

- Recommendations (quick fixes and medium-term):
  1. Document the exact shape of the fraud analysis result (JSON schema) and add it to shared/types or an OpenAPI components section.
  2. Extract and centralize commonly used thresholds/config (fraudPatterns, riskThresholds) into a config file (e.g., `server/config/fraud-config.js`) and load from environment or feature flags.
  3. Replace stubbed external checks incrementally: start with IP reputation integration (AbuseIPDB) and a lightweight behavioral rules engine, then add ML models as mounted services.
  4. Add unit tests for each analyzer function (happy path + failure modes) and integration tests that validate returned gating decisions for representative data.
  5. Add log retention and PII scrubbing policy for `fraud_logs` to prevent sensitive data leaks; redact full messages where not needed.
  6. Consolidate overlapping checks with `TrustEngine` into a single decisioning pipeline or clearly document precedence (which service's output gates final action).

---
- Purpose: Centralizes trust scoring, verification, and risk assessment for users and transactions.
- Dependencies: `query` (PostgreSQL), used in `trust.js`, `reputation.js`, `escrow.js`, `auth.js` via `req.trustEngine`.
- Key methods: `calculateTrustScore`, `verifyIdentity`, `recordTrustEvent`, `assessTransactionRisk`.
- Issues: Verification methods are stubbed; production should integrate real services. No circular dependencies.
- Suggestions: Integrate real verification, cache trust scores, document DB schema.

## EscrowManager.js
- Purpose: Manages escrow transactions, payment flows, dispute handling, and blockchain/Stripe integration.
- Dependencies: `query` (PostgreSQL), `ethers` (Polygon), `stripe` (payments), used in `escrow.js` via `req.escrowManager`.
- Key methods: `createEscrow`, `confirmCompletion`, `initiateDispute`, `resolveDispute`, `getEscrowStatus`.
- Issues: Blockchain escrow is stubbed; Stripe integration is direct. No circular dependencies.
- Suggestions: Integrate real blockchain/media validation, improve error handling, document DB schema.

## FraudDetection.js
- Purpose: Detects and analyzes fraud risk for user actions.
- Dependencies: `query` (PostgreSQL), used in `auth.js` via `req.fraudDetection`.
- Key methods: `analyzeFraudRisk`, specialized analyzers for registration, login, service creation, booking, messaging, profile updates.
- Issues: Many fraud pattern checks are stubbed; production should integrate real ML/IP reputation/behavioral analysis. No circular dependencies.
- Suggestions: Integrate real ML models, expand pattern matching, document DB schema.

## PaystackManager.js
- Purpose: Handles Paystack payment integration for transactions, subscriptions, transfers, and bank info.
- Dependencies: `query` (PostgreSQL), `axios`, used in `subscriptions.js`, `payments.js` via `req.paystackManager`.
- Key methods: `initializeTransaction`, `verifyTransaction`, `createTransferRecipient`, `initiateTransfer`, `getBankList`, `getSupportedCurrencies`.
- Issues: Error handling is robust. No circular dependencies.
- Suggestions: Secure key management, add test coverage, document DB schema.

## UserConnectionManager.js
- Purpose: Manages user-to-user connections, contact requests, service inquiries, blocking, and related notifications/conversations.
- Dependencies: `query` (PostgreSQL), used in `userConnections.js` as `connectionManager`.
- Key methods: `checkConnectionStatus`, `sendContactRequest`, `respondToContactRequest`, `getUserConnections`, `sendServiceInquiry`, `getPendingRequests`, `blockUser`.
- Issues: Notification and messaging logic tightly coupled to connection actions. No circular dependencies.
- Suggestions: Extract notification logic, add test coverage, document DB schema, review for duplicate logic.

## users.js & users.js.backup
- Purpose: REST API for user profile CRUD, browsing, and filtering. Handles authentication, profile updates, and public profile queries.
- Dependencies: `express`, `jwt`, `authMiddleware`, `query` (PostgreSQL).
- Connected Files: Used by API server, depends on `users` table, interacts with `profile_data` JSONB, subscription fields, and filtering logic.
- Duplicate Logic: `users.js.backup` is a legacy/alternate version. Main differences:
  - `users.js` has enhanced validation, subscription status indicators, and more robust filtering (e.g., excludes current user, validates token, more flexible location/age/category filters).
  - `users.js.backup` is simpler, less validation, no subscription status logic, and less robust filtering.
- Issues/Observations:
  - Duplicate files can cause confusion and maintenance risk. Only one should be used in production; the other should be archived or deleted after confirming no dependencies.
  - Filtering logic in both files is similar but not identical; ensure all business rules are unified in the main file.
  - Both files use parameterized queries and good error handling.
- Suggestions:
  - Remove or archive `users.js.backup` after confirming no references.
  - Refactor filtering logic to a shared utility if reused elsewhere.
  - Document expected shape of `profile_data` and subscription fields for frontend/backend consistency.

## services.js
- Purpose: REST API for service listings, creation, browsing, filtering, and category management. Handles public and authenticated queries, service creation, and view tracking.
- Dependencies: `express`, `authMiddleware`, `query` (PostgreSQL), depends on `services`, `service_categories`, `users` tables.
- Connected Files: Used by API server, interacts with service-related tables, and expects frontend to consume formatted service objects.
- Connectivity: No direct service manager import; all logic is inline or via DB queries. Filtering, creation, and formatting logic is tightly coupled to route file.
- Issues/Observations:
  - No clear separation between route/controller and business logic; all service management is done in the route file.
  - Risk of duplication if similar logic exists in other files (e.g., service creation, filtering, formatting).
  - View count increment and formatting logic could be extracted for reuse.
  - All queries are parameterized; error handling is robust.
- Suggestions:
  - Refactor business logic (creation, filtering, formatting) to dedicated service manager(s) for maintainability and reuse.
  - Audit other files for duplicate service logic and unify in a single service layer.
  - Document expected shape of service objects for frontend/backend consistency.

## chat.js
- Purpose: REST API for chat/conversation management, messaging, video calls, blocking, and conversation deletion. Handles public and authenticated queries, real-time socket events, and message CRUD.
- Dependencies: `express`, `authMiddleware`, `query` (PostgreSQL), `express-validator`, uses `req.io` for socket.io events. Depends on `conversations`, `messages`, `users`, `blocked_users` tables.
- Connected Files: Used by API server, expects frontend to consume formatted conversation/message objects. Real-time events are emitted via socket.io.
- Connectivity: All logic is inline or via DB queries; no dedicated chat service manager. Messaging, conversation, and video call logic is tightly coupled to route file.
- Issues/Observations:
  - No clear separation between route/controller and business logic; all chat management is done in the route file.
  - Risk of duplication if similar logic exists in other files (e.g., messaging, blocking, conversation creation).
  - Real-time socket events are emitted directly from route handlers.
  - All queries are parameterized; error handling is robust.
- Suggestions:
  - Refactor business logic (messaging, conversation, blocking) to dedicated chat service manager for maintainability and reuse.
  - Audit other files for duplicate chat/messaging logic and unify in a single service layer.
  - Document expected shape of conversation/message objects for frontend/backend consistency.

## auth.js (Registration & Login)

**Registration Endpoint**
- Uses express-validator for input validation (email, password, username, age, country, city).
- Invokes `req.fraudDetection.analyzeFraudRisk` for fraud analysis before user creation; risk level and verification requirements are returned in response.
- Checks for existing user by email, hashes password with bcrypt, inserts new user into DB.
- Records trust event via `req.trustEngine.recordTrustEvent` (action: 'register', includes fraud score, location, device info, impact based on fraud analysis).
- Issues JWT token with userId, username, verificationTier; returns user data (excluding sensitive info) and fraud analysis in response.
- Error handling: try/catch, environment-aware error messages.
- **Strengths:** Follows service injection pattern, robust validation, fraud/trust integration, secure password handling, clear error responses.
- **Risks:** Inline business logic (validation, DB ops, trust/fraud calls) could be refactored to dedicated service layer for maintainability. No explicit email verification step.
- **Recommendations:** Move business logic to service, add email verification, document expected data shapes.

**Login Endpoint**
- Validates input (email, password), supports mock authentication for test credentials if DB unavailable.
- Fetches user by email, checks for suspension, verifies password with bcrypt.
- Runs fraud detection on login (`req.fraudDetection.analyzeFraudRisk`), blocks login if risk detected.
- Updates last_active timestamp, records trust event for login (neutral impact).
- Issues JWT token, returns user data and security analysis.
- Error handling: try/catch, environment-aware error messages.
- **Strengths:** Service pattern for fraud/trust, robust error handling, mock mode for testing, clear suspension handling.
- **Risks:** Inline business logic (validation, DB ops, trust/fraud calls) could be refactored to service layer. Mock mode may risk exposure if left in production.
- **Recommendations:** Move business logic to service, restrict/remove mock mode in production, document expected data shapes.

**General Notes**
- Consistent use of parameterized queries for DB access.
- JWT payload includes verification tier for subscription/feature gating.
- Trust and fraud services are properly injected via middleware.
- Error responses follow API response pattern.
- No major duplication detected in registration/login logic.
- Next: Audit verification and token endpoints.

## auth.js (Verification & Token Endpoints)

**Verification Tier Upgrade Endpoint**
- Validates input (tier, verificationData) using express-validator.
- Checks current verification tier from DB, prevents downgrade or no-op upgrades.
- Invokes `req.trustEngine.verifyIdentity` for identity verification; returns results and upgrades tier if successful.
- Error handling: try/catch, environment-aware error messages, detailed failure responses.
- **Strengths:** Service injection pattern for trust/verification, robust validation, clear error responses.
- **Risks:** Inline business logic (validation, DB ops, trust calls) could be refactored to service layer. No explicit audit trail for verification attempts.
- **Recommendations:** Move business logic to service, add audit trail for verification attempts, document expected verificationData shape.

**Token Refresh Endpoint**
- Authenticates user via middleware, fetches fresh user data from DB.
- Issues new JWT token with updated user info.
- Error handling: try/catch, environment-aware error messages.
- **Strengths:** Follows service/middleware pattern, robust error handling, returns updated user data.
- **Risks:** Inline DB logic could be refactored to service layer.
- **Recommendations:** Move DB logic to service, document expected user object shape.

**Logout Endpoint**
- Relies on client-side token invalidation; no server-side token blacklist implemented.
- Returns success message only.
- **Strengths:** Simple, stateless logout.
- **Risks:** No server-side token revocation; may be insufficient for high-security use cases.
- **Recommendations:** Consider implementing token blacklist for enhanced security.

**Token Validation Endpoint**
- Validates JWT token, checks user existence and status in DB.
- Returns validity, user info, and error details.
- Error handling: try/catch, environment-aware error messages, specific JWT error handling.
- **Strengths:** Robust validation, clear error responses, checks for suspended users
- **Risks:** Inline DB logic could be refactored to service layer.
- **Recommendations:** Move DB logic to service, document expected user object shape.

**General Notes**
- Consistent use of parameterized queries and service/middleware patterns.
- Error handling is robust and environment-aware.
- No major duplication detected in verification/token logic.
- Next: Continue audits for other route/service pairs.

# Codebase Sector Map & File List

## Sectors & Files

### server/services
- AdultServiceManager.js
- BitnobManager.js
- CountryManager.js
- CryptoPaymentManager.js
- EscrowManager.js
- FraudDetection.js
- PaystackManager.js
- PerformanceMetrics.js
- PrivacyManager.js
- SystemHealthService.js
- TrustEngine.js
- UserActivityMonitor.js
- UserConnectionManager.js
- VerificationManager.js

### server/routes
- adultServices.js
- auth.js
- calls.js
- chat.js
- countries.js
- dashboard.js
- escrow.js
- notifications.js
- payments.js
- privacy.js
- reputation.js
- services.js
- status.js
- subscriptions.js
- transactions.js
- trust.js
- uploads.js
- userConnections.js
- users.js
- users.js.backup
- verification.js

### server/middleware
- performanceMonitoring.js

### client/src/components
- auth/
- CallButton.js
- CallSystem.js
- ChatSystem.js
- country/
- ErrorBoundary.js
- FrontendIntegrationTest.js
- IntegrationTest.js
- IntegrationTestSuite.js
- layout/
- LoadingSpinner.js
- NotificationSystem.js
- OptimizedImage.js
- payments/
- PerformanceMonitor.js
- PerformanceMonitoringDashboard.js
- SystemStatus.js
- UserAcceptanceTestSuite.js
- UserConnectionHub.js
- UserStatus.js
- video/
- VirtualizedList.js

### client/src/pages
- AdultServiceBrowse.js
- AdultServiceCreate.js
- AdultServiceDetail.js
- CreateServicePage.js
- DashboardPage.js
- HomePage.js
- LoginPage.js
- PrivacySettings.js
- ProfileBrowse.js
- ProfileDetailPage.js
- ProfilePage.js
- RegisterPage.js
- ServiceDetailPage.js
- ServicesPage.js
- SubscriptionErrorPage.js
- SubscriptionPage.js
- SubscriptionSuccessPage.js
- TransactionsPage.js
- TrustScorePage.js
- VerificationCenter.js
- VerificationPage.js

### client/src/contexts
- AuthContext.js
- SocketContext.js

### client/src/services
- authAPI.js
- countryAPI.js
- servicesAPI.js
- subscriptionAPI.js
- transactionsAPI.js
- trustAPI.js
- uiAPI.js
- userAPI.js

### client/src/store/slices
- authSlice.js
- countrySlice.js
- servicesSlice.js
- transactionsSlice.js
- trustSlice.js
- uiSlice.js
- userSlice.js

### shared/api, shared/security, shared/store, shared/types, shared/utils
- (empty)

### mobile/src
- (empty)

---

## PaystackManager.js — Detailed Audit

- File: `server/services/PaystackManager.js`
- Purpose: Wrapper around Paystack REST APIs for initializing/verifying transactions, creating transfer recipients, initiating transfers, and fetching bank/country data.
- Connected files / callers:
  - `server/routes/payments.js`, `server/routes/subscriptions.js`, `server/routes/escrow.js` (payment flows)
  - Any background jobs that reconcile payments or process webhooks

- Key exported class & methods:
  - PaystackManager (class)
  - initialize(), isHealthy()
  - initializeTransaction(transactionData)
  - verifyTransaction(reference)
  - getSupportedCurrencies()
  - createTransferRecipient(recipientData)
  - initiateTransfer(transferData)
  - getBankList()

- Observed external calls / network usage:
  - Uses `axios` to call Paystack API endpoints under `https://api.paystack.co` for transactions, transfers, recipients, and bank/country lists.
  - Authorization via `PAYSTACK_SECRET_KEY` header; public key also stored on class for client-side uses.

- Error handling and edge cases:
  - Robust logging of response errors and response data when present. Throws on API-level failures.
  - Initialization attempts a GET to `/transaction/verify/test` — verify this test endpoint exists and is appropriate for production checks; if not, prefer a lightweight `me` or `status` endpoint if available.

- Gaps and risks:
  - No webhook verification or idempotency handling is present in this manager — webhooks are typically handled in route layer but ensure verification and idempotency logic exists elsewhere.
  - Currency/unit conversion logic is implemented inline; confirm rounding/precision rules for each supported currency and centralize conversions to avoid inconsistencies.
  - Secret key usage should be validated during app startup and failures should be surfaced to monitoring (ServiceHealth).

- Recommendations:
  1. Add explicit idempotency support for initializeTransaction/initateTransfer (accept idempotency keys or reference lookups).
  2. Move currency conversion helpers into a shared util (`server/utils/currency.js`) and add unit tests for edge cases.
  3. Add a small retry/backoff wrapper for network calls and integrate with centralized HTTP client to enforce timeouts and retries.
  4. Ensure webhook handling routes verify Paystack signatures and handle duplicate webhook deliveries idempotently.

---

## UserConnectionManager.js — Detailed Audit

- File: `server/services/UserConnectionManager.js`
- Purpose: Manages user-to-user connections (contact requests), messaging initiation (conversations/messages creation for inquiries), blocking, and notifications tied to connections.
- Connected files / callers:
  - `server/routes/userConnections.js`, `server/routes/chat.js`, `server/routes/adultServices.js` (for service inquiries)
  - Notification system & `notifications` table consumers
  - `conversations` and `messages` usage in real-time socket events (Socket.io handlers)

- Key exported class & methods:
  - UserConnectionManager (class)
  - checkConnectionStatus(userId1, userId2)
  - sendContactRequest(fromUserId, toUserId, message, connectionType)
  - respondToContactRequest(connectionId, userId, action)
  - getUserConnections(userId)
  - sendServiceInquiry(fromUserId, toUserId, serviceId, message)
  - getPendingRequests(userId)
  - blockUser(blockerId, blockedId)

- Database queries observed:
  - SELECT user existence and verification tiers via `FROM users u1, users u2 WHERE u1.id = $1 AND u2.id = $2`
  - SELECT / INSERT / UPDATE on `user_connections`, `blocked_users`, `notifications`, `conversations`, `messages`, `services`, `users`
  - Inserts to `notifications` for contact requests and responses (payloads contain connection metadata)

- Behavioral notes & safety checks:
  - Checks for existing connections and blocked status before creating requests.
  - Uses ON CONFLICT in `blockUser` to avoid duplicate blocks.
  - Responding to contact requests creates conversations and sends a welcome message; this may duplicate logic with other conversation creation paths — centralize conversation creation in a single helper used by both chat and connection flows.

- Risks and improvements:
  - Notifications include free-form JSON metadata; ensure these payloads are small and PII-sanitized.
  - Conversation creation attempts to insert and then SELECT in subsequent inserts which may race if called concurrently; consider using RETURNING consistently or wrapping in a transaction.
  - Many operations span multiple DB writes—consider wrapping multi-step sequences (create connection + create notification) in transactions to avoid partial states on failure.

- Recommendations:
  1. Extract conversation creation logic to `server/services/ConversationManager.js` or shared helper and reuse across chat and connection flows.
  2. Wrap multi-step operations (e.g., accept request -> create conversation -> insert message -> notify) in DB transactions.
  3. Add unit/integration tests for edge cases (race conditions, duplicate requests, blocked user scenarios).
  4. Implement PII redaction for notification payloads and add size limits.

---

## AdultServiceManager.js — Detailed Audit

- File: `server/services/AdultServiceManager.js`
- Purpose: Encapsulates adult service category definitions, creation, search, CRUD operations, listing, stats, and search helper logic.
- Connected files / callers:
  - `server/routes/adultServices.js`, `server/routes/services.js`, `server/routes/search.js`
  - `server/services/FraudDetection.js` (service creation risk checks), `TrustEngine` (trust filters), `UserConnectionManager` (service inquiries)

- Key exported class & methods:
  - AdultServiceManager (class)
  - getServiceCategories()
  - createServiceListing(userId, serviceData)
  - getServiceListings(filters)
  - getServiceById(serviceId)
  - updateServiceListing(serviceId, userId, updateData)
  - deleteServiceListing(serviceId, userId)
  - getUserServices(userId)
  - searchServices(searchTerm, filters)
  - getServiceStats()

- Observed DB usage & patterns:
  - Uses `pg.Pool` directly and raw SQL text with parameterized queries.
  - Queries join `services` and `users` tables to populate provider metadata (username, verification_tier, trust_score).
  - Several filters and dynamic query building are implemented inline; ensure consistent naming for columns (`provider_id` vs `user_id` vs `user_id`) — I observed a potential mismatch in `createServiceListing` values vs SQL columns.

- Potential issue (must verify):
  - In `createServiceListing`, SQL INSERT lists columns `user_id, category_id, ...` but the values array is built as `[ userId, category, title, ... { address: location }, availability, specialRequirements, photos, 'active' ]`. The SQL uses `user_id, category_id, title, description, price, duration_minutes, location_type, location_data, media_urls, requirements, privacy_level, status, created_at`. The values mapping seems misaligned (e.g., `location_type` is expected but provided `{ address: location }`), and `privacy_level` may be missing or placed incorrectly. This could cause runtime errors or incorrect data insertion.

- Risks & recommendations:
  1. Fix `createServiceListing` values/column mapping to match the SQL column order. Prefer using explicit field mapping objects or named parameter helpers to avoid positional mismatches.
  2. Standardize column names for `services` (use `provider_id` consistently) and update all queries accordingly; add unit tests to catch naming mismatches.
  3. Move dynamic SQL construction for filtering to a helper that escapes identifiers and ensures consistent parameter ordering.
  4. Replace direct `pg.Pool` usage in this manager with the project's shared `query` helper (if one exists) to centralize connection pooling/config. If specialized pool config is needed, ensure it's documented and consistent.
  5. Add validation for `serviceData` (category, price ranges, duration) and call `FraudDetection` before insertion for high-risk listings.

# Systematic Dry Audit: server/services

## AdultServiceManager.js
- Purpose: Manages adult service listings, creation, and validation.
- Connected Files: Used in `server/routes/adultServices.js`, may also be referenced in service-related routes/components and profile/user flows.
- Audit Findings:
  - Business logic for adult service management is present, but validation and creation logic may be duplicated in route files (should be centralized for maintainability).
  - No circular dependencies detected; service is injected via middleware for route handlers.
  - Parameterized queries are used for DB access, reducing SQL injection risk.
  - Service object shapes should be documented for frontend/backend consistency.
  - No major duplication detected, but logic may overlap with other service managers—recommend cross-file review for consolidation.
  - Error handling is present but could be expanded for async failures and edge cases.
- Recommendations:
  - Centralize validation and creation logic in the service manager.
  - Document expected service object shapes.
  - Review for duplicate logic with other service managers and consolidate where possible.
  - Expand error handling for async failures and edge cases.

## BitnobManager.js
- Purpose: Handles Bitnob payment integration (if used).
- Connected Files: Check for usage in payment/transaction routes.
- Audit:
  - Verify integration points and error handling.
  - Ensure secure key management.
  - Document expected payment object shapes.

## CountryManager.js
- Purpose: Manages country data, validation, and queries.
- Connected Files: Used in `server/routes/countries.js`, registration/profile flows.
- Audit Findings:
  - Country validation logic is present, but may be duplicated in route files—should be centralized.
  - No circular dependencies detected; service is injected via middleware.
  - Parameterized queries used for DB access.
  - Country data shapes should be documented.
  - Error handling present, could be expanded for edge cases.
  - Recommendations: Centralize validation logic, document country data shapes, expand error handling.

## CryptoPaymentManager.js
- Purpose: Handles crypto payment integration (Polygon/Ethereum).
- Connected Files: Used in payment/escrow routes.
- Audit Findings:
  - Crypto integration logic present, but may be stubbed—should integrate real services.
  - No circular dependencies detected.
  - Parameterized queries used for DB access.
  - Crypto transaction shapes should be documented.
  - Error handling present, could be expanded for async failures.
  - Recommendations: Integrate real crypto services, document transaction shapes, expand error handling.

## EscrowManager.js
- Purpose: Manages escrow transactions, payment flows, dispute handling, and blockchain/Stripe integration.
- Connected Files: Used in `server/routes/escrow.js`, may also be referenced in `server/routes/transactions.js`, `server/routes/payments.js`, and by other payment/transaction managers.
- Audit Findings:
  - Business logic for escrow management is well-encapsulated, but blockchain escrow and some payment integrations are stubbed (should integrate real services for production).
  - No circular dependencies detected; service is injected via middleware for route handlers.
  - Parameterized queries are used for DB access, reducing SQL injection risk.
  - Dispute handling and status tracking are present, but expected escrow/dispute object shapes should be documented for frontend/backend consistency.
  - No major duplication detected, but logic may overlap with payment/transaction managers—recommend cross-file review for consolidation.
  - Error handling is robust, but could be expanded for async failures and edge cases.
- Recommendations:
  - Integrate real blockchain and payment services for production.
  - Document expected escrow/dispute object shapes.
  - Review for duplicate logic with payment/transaction managers and consolidate where possible.
  - Expand error handling for async failures and edge cases.

## FraudDetection.js
- Purpose: Detects and analyzes fraud risk for user actions.
- Connected Files: Used in `server/routes/auth.js`, may also be referenced in transaction, messaging, and profile-related routes/services.
- Audit Findings:
  - Business logic for fraud analysis is present, but many fraud pattern checks are stubbed (should integrate real ML/IP reputation/behavioral analysis for production).
  - No circular dependencies detected; service is injected via middleware for route handlers.
  - Parameterized queries are used for DB access, reducing SQL injection risk.
  - Fraud analysis results are returned in API responses, but expected result shapes should be documented for frontend/backend consistency.
  - No major duplication detected, but logic may overlap with other risk/scoring services—recommend cross-file review for consolidation.
  - Error handling is present but could be expanded for async failures and edge cases.
- Recommendations:
  - Integrate real ML/IP reputation/behavioral analysis for production.
  - Document expected fraud analysis result shapes.
  - Review for duplicate logic with other risk/scoring services and consolidate where possible.
  - Expand error handling for async failures and edge cases.

## PaystackManager.js
- Purpose: Handles Paystack payment integration for transactions, subscriptions, transfers, and bank info.
- Connected Files: Used in `server/routes/subscriptions.js`, `server/routes/payments.js`, may also be referenced in transaction and escrow-related routes/services.
- Audit Findings:
  - Business logic for Paystack integration is present and robust, with secure key management and error handling.
  - No circular dependencies detected; service is injected via middleware for route handlers.
  - Parameterized queries are used for DB access, reducing SQL injection risk.
  - Payment/transfer object shapes should be documented for frontend/backend consistency.
  - No major duplication detected, but logic may overlap with other payment/transaction managers—recommend cross-file review for consolidation.
  - Error handling is robust, but could be expanded for async failures and edge cases.
- Recommendations:
  - Document expected payment/transfer object shapes.
  - Review for duplicate logic with other payment/transaction managers and consolidate where possible.
  - Expand error handling for async failures and edge cases.

## PerformanceMetrics.js
- Purpose: Tracks system performance metrics.
- Connected Files: Used in monitoring/middleware.
- Audit Findings:
  - Metric collection logic present, ensure minimal performance overhead.
  - No circular dependencies detected.
  - Recommendations: Document metric shapes, review for performance impact.

## PrivacyManager.js
- Purpose: Manages privacy controls and user data access.
- Connected Files: Used in `server/routes/privacy.js`, profile/user routes.
- Audit Findings:
  - Privacy enforcement logic present, but may be duplicated in route files—should be centralized.
  - No circular dependencies detected.
  - Privacy control shapes should be documented.
  - Error handling present, could be expanded for edge cases.
  - Recommendations: Centralize privacy logic, document control shapes, expand error handling.

## SystemHealthService.js
- Purpose: Monitors system health and status.
- Connected Files: Used in status/dashboard routes.
- Audit Findings:
  - Health check logic present, ensure minimal performance overhead.
  - No circular dependencies detected.
  - Recommendations: Document health check shapes, review for performance impact.

## TrustEngine.js
- Purpose: Centralizes trust scoring, verification, and risk assessment for users and transactions.
- Connected Files: Used in `server/routes/trust.js`, `server/routes/auth.js`, `server/routes/escrow.js`, `server/routes/reputation.js`.
- Audit Findings:
  - Business logic for trust scoring and verification is well-encapsulated, but some verification methods are stubbed (should integrate real services for production).
  - No circular dependencies detected; service is injected via middleware for route handlers.
  - Parameterized queries are used for DB access, reducing SQL injection risk.
  - Trust event recording is robust, but expected event/result shapes should be documented for frontend/backend consistency.
  - No major duplication detected, but some logic may overlap with reputation/verification managers—recommend cross-file review for consolidation.
  - Error handling is present but could be expanded for edge cases and async failures.
- Recommendations:
  - Integrate real verification services for production.
  - Document expected trust event/result shapes.
  - Review for duplicate logic with reputation/verification managers and consolidate where possible.
  - Expand error handling for edge cases.

## UserActivityMonitor.js
- Purpose: Monitors user activity for analytics and security.
- Connected Files: Used in monitoring/middleware.
- Audit Findings:
  - Activity tracking logic present, ensure minimal performance overhead.
  - No circular dependencies detected.
  - Recommendations: Document activity event shapes, review for performance impact.

## UserConnectionManager.js
- Purpose: Manages user-to-user connections, contact requests, blocking, and related notifications/conversations.
- Connected Files: Used in `server/routes/userConnections.js`, may also be referenced in chat/messaging routes/services and notification systems.
- Audit Findings:
  - Business logic for connection management is present, but notification and messaging logic is tightly coupled to connection actions (should be separated for maintainability).
  - No circular dependencies detected; service is injected via middleware for route handlers.
  - Parameterized queries are used for DB access, reducing SQL injection risk.
  - Connection object shapes should be documented for frontend/backend consistency.
  - No major duplication detected, but logic may overlap with chat/messaging managers—recommend cross-file review for consolidation.
  - Error handling is present but could be expanded for async failures and edge cases.
- Recommendations:
  - Extract notification and messaging logic to dedicated service(s).
  - Document expected connection object shapes.
  - Review for duplicate logic with chat/messaging managers and consolidate where possible.
  - Expand error handling for async failures and edge cases.

## VerificationManager.js
- Purpose: Manages user verification processes.
- Connected Files: Used in `server/routes/verification.js`, registration/auth routes.
- Audit Findings:
  - Verification logic present, but may be duplicated in route files—should be centralized.
  - No circular dependencies detected.
  - Verification result shapes should be documented.
  - Error handling present, could be expanded for edge cases.
  - Recommendations: Centralize verification logic, document result shapes, expand error handling.

---
Next: Continue with systematic dry audit for server/routes sector, listing and auditing all directly connected/communicating files for each route.
---
# Systematic Dry Audit: server/routes

## adultServices.js
- Purpose: Manages adult service API endpoints (listing, creation, validation).
- Connected Files: Likely uses `AdultServiceManager.js`, may interact with user/profile, payment, and privacy routes/services.
- Audit:
  - Check for clear separation of route/controller and business logic.
  - Ensure parameterized queries and robust error handling.
  - Document expected request/response shapes.
  - Flag any duplicate logic with other service-related routes.

## auth.js
- Purpose: Handles authentication (registration, login, verification, token management).
- Connected Files: Uses `FraudDetection.js`, `TrustEngine.js`, `VerificationManager.js`, interacts with user/profile, subscription, and privacy routes/services.
- Audit:
  - Ensure robust validation, fraud/trust integration, and error handling.
  - Check for proper service/middleware usage.
  - Document expected request/response shapes.
  - Flag any duplicate logic with other auth/verification routes.

## calls.js
- Purpose: Manages call signaling and video call API endpoints.
- Connected Files: Likely uses video/call managers, interacts with user, chat, and notification routes/services.
- Audit:
  - Check for clear separation of signaling logic and business logic.
  - Ensure robust error handling and real-time event management.
  - Document expected call event/request shapes.

## chat.js
- Purpose: Handles chat, messaging, conversation, and blocking API endpoints.
- Connected Files: Uses `UserConnectionManager.js`, interacts with user, notification, and possibly video/call routes/services.
- Audit:
  - Ensure separation of messaging/conversation logic and route/controller.
  - Check for robust error handling and real-time event management.
  - Document expected message/conversation object shapes.
  - Flag any duplicate logic with user connection or notification routes.

## countries.js
- Purpose: Manages country data API endpoints.
- Connected Files: Uses `CountryManager.js`, interacts with registration/profile routes/services.
- Audit:
  - Ensure robust validation and error handling.
  - Document expected country data shapes.

## dashboard.js
- Purpose: Handles dashboard data API endpoints.
- Connected Files: Uses `SystemHealthService.js`, interacts with user, service, and transaction routes/services.
- Audit:
  - Ensure correct aggregation and reporting logic.
  - Check for robust error handling.

## escrow.js
- Purpose: Manages escrow transaction API endpoints.
- Connected Files: Uses `EscrowManager.js`, interacts with payment, user, and dispute routes/services.
- Audit:
  - Ensure separation of escrow logic and route/controller.
  - Check for robust error handling and parameterized queries.
  - Document expected escrow object shapes.

## notifications.js
- Purpose: Handles notification API endpoints.
- Connected Files: Likely uses notification managers, interacts with user, chat, and service routes/services.
- Audit:
  - Ensure robust notification delivery and error handling.
  - Document expected notification object shapes.

## payments.js
- Purpose: Manages payment API endpoints.
- Connected Files: Uses `PaystackManager.js`, `CryptoPaymentManager.js`, interacts with user, escrow, and subscription routes/services.
- Audit:
  - Ensure robust payment processing and error handling.
  - Document expected payment/transaction object shapes.

## privacy.js
- Purpose: Handles privacy control API endpoints.
- Connected Files: Uses `PrivacyManager.js`, interacts with user/profile routes/services.
- Audit:
  - Ensure robust privacy enforcement and error handling.
  - Document expected privacy control object shapes.

## reputation.js
- Purpose: Manages reputation scoring API endpoints.
- Connected Files: Uses `TrustEngine.js`, interacts with user, service, and transaction routes/services.
- Audit:
  - Ensure robust reputation logic and error handling.
  - Document expected reputation event/result shapes.

## services.js
- Purpose: Handles service listing, creation, and filtering API endpoints.
- Connected Files: May use `AdultServiceManager.js`, interacts with user, category, and profile routes/services.
- Audit:
  - Ensure separation of service logic and route/controller.
  - Check for robust error handling and parameterized queries.
  - Document expected service object shapes.
  - Flag any duplicate logic with other service-related routes.

## status.js
- Purpose: Handles system status API endpoints.
- Connected Files: Uses `SystemHealthService.js`, interacts with dashboard and monitoring routes/services.
- Audit:
  - Ensure correct status reporting and error handling.

## subscriptions.js
- Purpose: Manages subscription API endpoints.
- Connected Files: Uses `PaystackManager.js`, interacts with user, payment, and profile routes/services.
- Audit:
  - Ensure robust subscription management and error handling.
  - Document expected subscription object shapes.

## transactions.js
- Purpose: Handles transaction API endpoints.
- Connected Files: Uses `EscrowManager.js`, `PaystackManager.js`, `CryptoPaymentManager.js`, interacts with user, payment, and service routes/services.
- Audit:
  - Ensure robust transaction processing and error handling.
  - Document expected transaction object shapes.

## trust.js
- Purpose: Manages trust scoring API endpoints.
- Connected Files: Uses `TrustEngine.js`, interacts with user, reputation, and verification routes/services.
- Audit:
  - Ensure robust trust event processing and error handling.
  - Document expected trust event/result shapes.

## uploads.js
- Purpose: Handles file upload API endpoints.
- Connected Files: Interacts with user, service, and profile routes/services.
- Audit:
  - Ensure robust file validation and error handling.
  - Document expected upload object shapes.

## userConnections.js
- Purpose: Manages user connection API endpoints.
- Connected Files: Uses `UserConnectionManager.js`, interacts with user, chat, and notification routes/services.
- Audit:
  - Ensure robust connection management and error handling.
  - Document expected connection object shapes.
  - Flag any duplicate logic with chat/messaging routes.

## users.js / users.js.backup
- Purpose: Handles user profile CRUD, browsing, and filtering API endpoints.
- Connected Files: Interacts with profile, subscription, and service routes/services.
- Audit:
  - Ensure robust user management and error handling.
  - Document expected user object shapes.
  - Flag any duplicate logic between main and backup files; recommend consolidation.

## verification.js
- Purpose: Manages user verification API endpoints.
- Connected Files: Uses `VerificationManager.js`, interacts with auth, trust, and profile routes/services.
- Audit:
  - Ensure robust verification logic and error handling.
  - Document expected verification result shapes.

---
Next: Continue with systematic dry audit for client/src/components sector, listing each component, its purpose, connected files, and audit checklist. Prepare to continue with client/src/pages sector next.
---
# Systematic Dry Audit: client/src/components

## auth/
- Purpose: Contains authentication-related UI components (login, register, etc.).
- Connected Files: Uses `AuthContext.js`, interacts with `authAPI.js`, Redux slices, and pages like `LoginPage.js`, `RegisterPage.js`.
- Audit:
  - Ensure clear separation of UI, state, and API logic.
  - Check for robust error handling and validation.
  - Document expected props and state shapes.
  - Flag any duplicate logic with other auth components/pages.

## CallButton.js / CallSystem.js / video/
- Purpose: Manages call initiation, signaling, and video call UI.
- Connected Files: Uses `SocketContext.js`, interacts with call/chat components, pages, and backend call routes.
- Audit:
  - Ensure robust event handling and UI feedback.
  - Check for correct socket integration and error handling.
  - Document expected event/prop shapes.

## ChatSystem.js
- Purpose: Handles chat UI, messaging, and conversation management.
- Connected Files: Uses `SocketContext.js`, interacts with chat/user connection components, pages, and backend chat routes.
- Audit:
  - Ensure separation of UI, state, and socket logic.
  - Check for robust error handling and real-time updates.
  - Document expected message/conversation object shapes.
  - Flag any duplicate logic with other messaging components/pages.

## country/
- Purpose: Country selection and display UI components.
- Connected Files: Uses `countryAPI.js`, interacts with registration/profile components/pages.
- Audit:
  - Ensure robust validation and error handling.
  - Document expected country data shapes.

## ErrorBoundary.js
- Purpose: Global error boundary for React components.
- Connected Files: Wraps route/page components, interacts with notification/toast system.
- Audit:
  - Ensure correct error capture and fallback UI.
  - Document expected error object shapes.

## FrontendIntegrationTest.js / IntegrationTest.js / IntegrationTestSuite.js / UserAcceptanceTestSuite.js
- Purpose: Automated/manual integration and acceptance testing components.
- Connected Files: Interacts with all major UI flows, Redux store, and API services.
- Audit:
  - Ensure comprehensive test coverage and clear reporting.
  - Document expected test case/result shapes.

## layout/
- Purpose: Layout components (Navbar, Footer, etc.).
- Connected Files: Used by all pages/components, interacts with routing and context providers.
- Audit:
  - Ensure responsive design and accessibility.
  - Document expected layout prop shapes.

## LoadingSpinner.js
- Purpose: Loading indicator component.
- Connected Files: Used by async UI flows, interacts with API/service calls.
- Audit:
  - Ensure correct loading state management.

## NotificationSystem.js
- Purpose: Displays notifications and toasts.
- Connected Files: Interacts with error boundary, API/service calls, and Redux store.
- Audit:
  - Ensure robust notification delivery and error handling.
  - Document expected notification object shapes.

## OptimizedImage.js
- Purpose: Optimized image rendering component.
- Connected Files: Used by profile/service UI, interacts with image upload/display flows.
- Audit:
  - Ensure correct image optimization and error handling.

## payments/
- Purpose: Payment UI components (checkout, status, etc.).
- Connected Files: Uses `paymentsAPI.js`, interacts with payment pages and backend payment routes.
- Audit:
  - Ensure robust payment flow and error handling.
  - Document expected payment object shapes.

## PerformanceMonitor.js / PerformanceMonitoringDashboard.js / SystemStatus.js
- Purpose: System performance/status monitoring UI.
- Connected Files: Interacts with backend status/metrics routes, Redux store.
- Audit:
  - Ensure correct metric display and error handling.

## UserConnectionHub.js / UserStatus.js
- Purpose: User connection/status UI components.
- Connected Files: Uses `userAPI.js`, interacts with user connection pages/components and backend user connection routes.
- Audit:
  - Ensure robust connection/status display and error handling.
  - Document expected user/connection object shapes.

## VirtualizedList.js
- Purpose: Efficiently renders large lists in UI.
- Connected Files: Used by browse/search pages/components.
- Audit:
  - Ensure correct virtualization and performance.

---
Next: Continue with systematic dry audit for client/src/pages sector, listing and auditing all directly connected/communicating files for each page.
---
# Systematic Dry Audit: client/src/pages

## AdultServiceBrowse.js / AdultServiceCreate.js / AdultServiceDetail.js / CreateServicePage.js / ServiceDetailPage.js / ServicesPage.js
- Purpose: Manage browsing, creation, and detail display of adult services.
- Connected Files: Use service-related components, `servicesAPI.js`, Redux slices, and backend service routes.
- Audit:
  - Ensure clear separation of UI, state, and API logic.
  - Check for robust error handling and validation.
  - Document expected service object shapes and props.
  - Flag any duplicate logic with other service pages/components.

## DashboardPage.js / SystemStatus.js / PerformanceMonitoringDashboard.js
- Purpose: Display dashboard and system status/performance.
- Connected Files: Use monitoring/status components, interact with backend status/metrics routes and Redux store.
- Audit:
  - Ensure correct metric aggregation and display.
  - Check for robust error handling.

## HomePage.js
- Purpose: Main landing page UI.
- Connected Files: Uses layout, navigation, and featured components.
- Audit:
  - Ensure responsive design and accessibility.

## LoginPage.js / RegisterPage.js / VerificationPage.js / VerificationCenter.js
- Purpose: Manage authentication, registration, and verification flows.
- Connected Files: Use auth components, `AuthContext.js`, `authAPI.js`, Redux slices, and backend auth/verification routes.
- Audit:
  - Ensure robust validation, error handling, and state management.
  - Document expected user/verification object shapes.
  - Flag any duplicate logic with other auth/verification pages/components.

## PrivacySettings.js
- Purpose: Manage user privacy settings.
- Connected Files: Uses privacy components, `privacyAPI.js`, interacts with backend privacy routes.
- Audit:
  - Ensure robust privacy control and error handling.
  - Document expected privacy object shapes.

## ProfileBrowse.js / ProfileDetailPage.js / ProfilePage.js
- Purpose: Manage browsing and display of user profiles.
- Connected Files: Use profile/user components, `userAPI.js`, Redux slices, and backend user/profile routes.
- Audit:
  - Ensure robust profile display and error handling.
  - Document expected user/profile object shapes.
  - Flag any duplicate logic with other profile pages/components.

## SubscriptionPage.js / SubscriptionErrorPage.js / SubscriptionSuccessPage.js
- Purpose: Manage subscription flows and feedback.
- Connected Files: Use subscription/payment components, `subscriptionAPI.js`, interacts with backend subscription/payment routes.
- Audit:
  - Ensure robust subscription management and error handling.
  - Document expected subscription object shapes.

## TransactionsPage.js
- Purpose: Display user transactions.
- Connected Files: Uses transaction components, `transactionsAPI.js`, interacts with backend transaction routes.
- Audit:
  - Ensure correct transaction display and error handling.
  - Document expected transaction object shapes.

## TrustScorePage.js
- Purpose: Display user trust score and related info.
- Connected Files: Uses trust components, `trustAPI.js`, interacts with backend trust/reputation routes.
- Audit:
  - Ensure correct trust score display and error handling.
  - Document expected trust event/result shapes.

---
Next: Continue with systematic dry audit for client/src/contexts, services, and store/slices sectors, listing and auditing all directly connected/communicating files for each.
---
# Systematic Dry Audit: client/src/contexts, services, store/slices

## contexts/AuthContext.js
- Purpose: Provides authentication state/context to React components.
- Connected Files: Used by auth components/pages, interacts with `authAPI.js`, Redux `authSlice.js`, and backend auth routes.
- Audit:
  - Ensure single source of truth for auth state (Redux).
  - Check for correct initialization and token validation logic.
  - Document expected context value shapes.
  - Flag any duplicate or unsynchronized state logic.

## contexts/SocketContext.js
- Purpose: Provides socket.io connection/context to React components.
- Connected Files: Used by chat, call, notification components/pages, interacts with backend socket.io events.
- Audit:
  - Ensure robust connection management and event handling.
  - Document expected context value/event shapes.

## services/authAPI.js, countryAPI.js, servicesAPI.js, subscriptionAPI.js, transactionsAPI.js, trustAPI.js, uiAPI.js, userAPI.js
- Purpose: API service modules for frontend-backend communication.
- Connected Files: Used by corresponding components/pages, Redux slices, and context providers.
- Audit:
  - Ensure clear separation of API logic and UI/state logic.
  - Check for robust error handling and parameterized requests.
  - Document expected request/response shapes.
  - Flag any duplicate or redundant API logic.

## store/slices/authSlice.js, countrySlice.js, servicesSlice.js, transactionsSlice.js, trustSlice.js, uiSlice.js, userSlice.js
- Purpose: Redux slices for managing state of auth, country, services, transactions, trust, UI, and user data.
- Connected Files: Used by components/pages, context providers, and API services.
- Audit:
  - Ensure clear separation of state, actions, and selectors.
  - Check for robust error handling and state updates.
  - Document expected state shape and action payloads.
  - Flag any duplicate or redundant state logic.

---
# Sector Mapping and Audit Preparation Complete

All sectors and code files are mapped and listed. Systematic dry audit checklists are now in place for every file in every sector. Next steps: Begin detailed file-by-file audits, documenting findings and connectivity issues for each file and its connections in AUDIT_REPORT.md.

---
# Detailed File Audit: server/services/TrustEngine.js

## TrustEngine.js
- Purpose: Centralizes trust scoring, verification, and risk assessment for users and transactions.
- Connected Files: Used in `server/routes/trust.js`, `server/routes/auth.js`, `server/routes/escrow.js`, `server/routes/reputation.js`.
- Audit Findings:
  - Business logic for trust scoring and verification is well-encapsulated, but some verification methods are stubbed (should integrate real services for production).
  - No circular dependencies detected; service is injected via middleware for route handlers.
  - Parameterized queries are used for DB access, reducing SQL injection risk.
  - Trust event recording is robust, but expected event/result shapes should be documented for frontend/backend consistency.
  - No major duplication detected, but some logic may overlap with reputation/verification managers—recommend cross-file review for consolidation.
  - Error handling is present but could be expanded for edge cases and async failures.
- Recommendations:
  - Integrate real verification services for production.
  - Document expected trust event/result shapes.
  - Review for duplicate logic with reputation/verification managers and consolidate where possible.
  - Expand error handling for edge cases.

---
Next: Audit server/services/EscrowManager.js, listing all connected files and documenting findings and connectivity issues.

---
## Duplication Inventory & Quick Actions

This section lists duplicate, backup, legacy, or obviously redundant files found during the dry audit, with a short risk assessment and a recommended quick action (archive/merge/delete) and verification steps to safely apply the change.

1) server/routes/users.js.backup
  - Type: backup / legacy route file
  - Risk: Low (appears to be a prior version of `users.js`) but could be referenced by scripts or by developers during manual runs.
  - Quick action: Archive (move to `server/legacy/` or `archive/`) or delete after verifying no references. Do NOT delete until dependency check completed.
  - Verification steps:
    - Search repository for references to `users.js.backup` (no references were found during the audit).
    - Run integration tests (if present) and smoke tests for users endpoints.
    - Optionally, rename to `users.js.backup.ARCHIVED-<date>` and commit to preserve history.

-- Action taken (2025-09-29):
  - Archived `server/routes/users.js.backup` to `server/legacy/users.js.backup.ARCHIVED-2025-09-29`.
  - Removed the original `server/routes/users.js.backup` from the routes folder to reduce confusion.
  - Added `.gitignore` entries to exclude `server/.env` (and variants), `client/playwright-report/`, `client/test-results/`, and `server/legacy/` from source control.
  - Rationale: low-risk archival preserves the file for recovery while removing clutter from the active routes directory.

2) client/playwright-report/index.html (generated test artifact)
  - Type: generated report / artifact
  - Risk: Very low. Large file occupying repo space; unnecessary in source control.
  - Quick action: Move to `.gitignore` and remove from repo history if desired (use git filter-repo / BFG for large history cleanups).
  - Verification steps:
    - Confirm it's a test report and not used at runtime.
    - Remove from repo and ensure CI still passes.

3) server/.env, server/env.local, server/env.test, server/env.example (multiple env files)
  - Type: environment files (templates and local overrides)
  - Risk: Medium. `.env` may contain secrets—should be excluded from VCS. `env.example` should remain.
  - Quick action: Ensure `server/.env` is in `.gitignore`. Move sensitive values to secure vault and keep `env.example` in repo.
  - Verification steps:
    - Search for accidental secrets in repo (done during audit, none flagged but re-run automated secret scanner).
    - Add `.env` to `.gitignore` if missing and rotate any exposed secrets.

4) client/playwright-report/ and client/test-results/ (test artifacts)
  - Type: generated artifacts
  - Risk: Low but add noise and increase repo size.
  - Quick action: Add to `.gitignore` and remove from repo history if needed.
  - Verification steps: Ensure CI does not require them to be present in repository.

5) server/*legacy* or *backup* script files (pattern observed across repo: `update-profiles-endpoint.js`, `test-user-update-now.js`, `cleanup-duplicate-services.js`)
  - Type: maintenance / migration / cleanup scripts
  - Risk: Medium. Some are intended one-off scripts and may be kept; others may be duplicates.
  - Quick action: Move one-off scripts to `scripts/maintenance/` or `tools/` and document purpose in README.
  - Verification steps: Run scripts in isolated environment to validate purpose; document expected side-effects.

6) Duplicate code inside route files (inline business logic vs service managers)
  - Type: code duplication across `services.js`, `chat.js`, `users.js`, `auth.js` (validation, DB queries, formatting)
  - Risk: High for maintainability. Bug fixes often need to be repeated across files.
  - Quick action: Prioritize extraction of shared logic into dedicated service managers and small utility modules (e.g., `formatUserProfile`, `buildUserFilters`, `validateProfileData`).
  - Verification steps: Create unit tests for extracted utilities, run integration tests, and ensure API responses unchanged.

7) Legacy payment code (StripeManager / legacy references)
  - Type: legacy payment integration code and env comments (Stripe legacy sections).
  - Risk: Medium. Keeps older integrations, possibly used for international users.
  - Quick action: If Stripe is intentionally legacy, consolidate code under `payments/legacy/stripe` and document migration plan. Remove env fallbacks referencing legacy keys.
  - Verification steps: Confirm supported payment methods in production config and run payment integration tests.

---
Notes:
- I scanned obvious backup/duplicate patterns and the `AUDIT_REPORT.md` already references `users.js.backup`. The quick actions above are prioritized low-risk first (archive generated/test artifacts, then archive legacy backups, then refactor inline duplication).
- Next step (if you want me to continue): I can implement the low-risk changes now (create an `archive/` or `server/legacy/` folder and move `server/routes/users.js.backup` into it, update `.gitignore` to exclude test artifacts), or produce a prioritized refactor plan with concrete PR-sized tasks for merging duplicated logic into services.
