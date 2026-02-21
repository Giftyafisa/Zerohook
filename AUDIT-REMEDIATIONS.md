# Zerohook Platform — Audit Remediations Log

**Date:** 2026-02-20  
**Scope:** Full-stack audit across Server (Node.js), Client (React), Mobile (Android/Kotlin)

---

## Completed Fixes

### 1. [CRITICAL] Password Validation Mismatch — `server/routes/auth.js`
- **Before:** `isLength({ min: 6 })` but error message said "at least 8 characters"
- **After:** `isLength({ min: 8, max: 128 })` with message "between 8 and 128 characters"
- **Why max 128:** Prevents bcrypt DoS — bcrypt truncates at 72 bytes, and extremely long passwords waste CPU on hashing

### 2. [CRITICAL] Production Mock Data Leak — `server/routes/users.js` (prior session)
- **Before:** Database errors returned fake mock profiles in production
- **After:** Mock data only in development; production returns 503

### 3. [HIGH] Room DB Destructive Migration — `mobile/.../ZerohookDatabase.kt` + `AppModule.kt`
- **Before:** `fallbackToDestructiveMigration()` silently wiped offline cache on any schema change
- **After:** Explicit `MIGRATION_1_2` object (no-op for v1→v2), `ALL_MIGRATIONS` array, `exportSchema = true`
- **Pattern:** All future schema changes require a new Migration object

### 4. [HIGH] OkHttp Auth Interceptor Blocking — `mobile/.../AppModule.kt`
- **Before:** `runBlocking(Dispatchers.IO)` on every HTTP request to read auth token from encrypted preferences
- **After:** Volatile `cachedToken` kept in sync via `Flow.collect` on IO coroutine scope; interceptor reads volatile field lock-free. One-time seed on init via `runBlocking` for first-request safety.

### 5. [HIGH] Auth Token Header Leaking in Logs — `mobile/.../AppModule.kt` (prior session)
- Added `redactHeader("Authorization")`, `redactHeader("Cookie")`, `redactHeader("Set-Cookie")`

### 6. [HIGH] Mobile Horizontal Overflow — `client/.../MobileShell.js` + `MainLayout.js` (prior session)
- Replaced `100vw` with `100%` to prevent scrollbar-induced overflow

### 7. [MEDIUM] Chat Message Performance — `server/config/database.js` + `server/routes/chat.js`
- Added compound MongoDB indexes on `messages` collection:
  - `{ conversationId: 1, createdAt: 1 }` — message listing
  - `{ conversationId: 1, senderId: 1, readAt: 1 }` — unread count + mark-as-read
- Rewrote `/api/chat/unread-count` to use single aggregation pipeline instead of two round-trips

### 8. [MEDIUM] Cursor Pagination for Chat Messages — `server/routes/chat.js`
- Replaced unbounded `Message.find()` with cursor-based pagination
- Supports `?before=<id>`, `?after=<id>`, `?limit=N` query params
- Response includes `pagination: { hasMore, limit, oldestId, newestId }`

### 9. [MEDIUM] Unified Auth Middleware — `server/routes/auth.js` + `server/routes/users.js`
- Created `optionalAuthMiddleware` — populates `req.user` if valid token present, otherwise `null`
- Replaced manual JWT parsing in `/profiles`, `/browse`, `/:id` routes with `optionalAuthMiddleware`
- Eliminates duplicated auth logic and potential inconsistencies

### 10. [MEDIUM] Log Redaction Sweep — `ChatSystem.js`, `users.js`, `chat.js`
- **ChatSystem.js:** 21 `console.log` → `debugLog` (no-op in production via `process.env.NODE_ENV`)
- **users.js:** 18 `console.log` → `debugLog`
- **chat.js:** 6 `console.log` → `debugLog`
- `console.error` calls preserved (they track actual errors, not debug chatter)

### 11. [LOW] PostgreSQL Legacy Cleanup
- Moved to `server/backup/postgresql-legacy/`:
  - `database.pg.js.backup`
  - `fix-database.sql` (both server/ and root/)
  - `setup-database.js`

---

## Remaining Items (Not Yet Implemented)

### Component Splitting
- `client/src/components/ChatSystem.js` is 2800 lines — consider splitting into:
  - `ChatConversationList.js`
  - `ChatMessageView.js`
  - `ChatFilePreview.js`
  - `ChatContextMenu.js`

### Subscription Route MongoDB Migration
- `server/routes/subscriptions.js` still uses `query()` (broken PostgreSQL wrapper)
- Needs full migration to Mongoose `Subscription` / `SubscriptionPlan` models

### Additional Security Hardening
- JWT algorithm should be pinned to `HS256` in all `jwt.verify()` calls (currently only in `authMiddleware`)
- Consider adding CSRF protection for state-changing endpoints
- Rate limit payment creation endpoints

### Mobile Improvements
- Consider switching all build types to production API URL only in release (currently all point to render)
- Add certificate pinning for production API domain
- Replace `io.socket:socket.io-client:2.1.0` with v4.x for performance + reconnection improvements

### Performance
- Add Redis caching for hot paths: `/api/chat/unread-count`, `/api/users/profiles`
- Consider denormalized `unreadCount` field on Conversation schema (increment on message create, reset on read)
- Profile browse fetches 200 results then slices — consider server-side limit in MongoRecommendationEngine
