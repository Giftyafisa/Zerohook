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
