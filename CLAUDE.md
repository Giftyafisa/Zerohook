# ZEROHOOK — AUTONOMOUS ENGINEERING INTELLIGENCE

> Project memory for the ZH-Nexus multi-agent system. Auto-loaded as persistent context.
> This is the neural substrate — the shared knowledge that all 8 specialist agents can access.

---

## PLATFORM IDENTITY

| Field | Value |
|-------|-------|
| **Platform** | Zerohook — Secure Service Marketplace |
| **Market** | African markets (Nigeria, Ghana, Kenya) |
| **Frontend** | React 18 + Redux Toolkit → `/client/src/` |
| **Backend** | Node.js 18+ + Express 4 → `/server/` |
| **Database** | MongoDB 7+ via Mongoose (MIGRATED from PostgreSQL) |
| **Real-time** | Socket.io 4 (chat, video calls, notifications, presence) |
| **Payments** | Paystack (Africa), Stripe (international), CryptoPaymentManager (ETH/Polygon) |
| **Storage** | Cloudinary (images/files), local `/uploads/` fallback |
| **Deploy** | Render (backend + frontend), MongoDB Atlas, Cloudinary CDN |
| **Entry** | `server/index.js` (1222 lines) — Express + Socket.io + all service wiring |

---

## AGENT NEURAL NETWORK

```
                        ┌──────────────────┐
                        │   ZH-NEXUS       │
                        │  (Orchestrator)   │
                        │  claudecode.md    │
                        └────────┬─────────┘
                                 │
          ┌───────┬──────┬───────┼───────┬──────┬───────┬────────┐
          │       │      │       │       │      │       │        │
       Backend  Frontend  DB   Security  RT   DevOps  Debug  Refactor
       ZH-BE    ZH-FE   ZH-DB  ZH-SEC  ZH-RT  ZH-DO  ZH-BG  ZH-RF
```

| Agent | File | Domain | Activation Signal |
|-------|------|--------|-------------------|
| **ZH-Nexus** | `claudecode.agent.md` | Orchestration, routing, causal reasoning, self-healing | Any task (central brain) |
| **ZH-Backend** | `backend.agent.md` | Express routes, services, middleware, API design | API work, endpoints, handlers |
| **ZH-Frontend** | `frontend.agent.md` | React, Redux, components, state management, UX | UI work, components, styling |
| **ZH-Database** | `database.agent.md` | MongoDB, Mongoose, schema, migration, optimization | Queries, schema, migration |
| **ZH-Security** | `security.agent.md` | Auth, JWT, trust, fraud, rate limiting, privacy | Auth bugs, security, trust system |
| **ZH-Realtime** | `realtime.agent.md` | Socket.io, chat, WebRTC, notifications, presence | Chat, calls, socket events |
| **ZH-DevOps** | `devops.agent.md` | Testing, CI/CD, performance, deployment, monitoring | Tests, deploys, performance |
| **ZH-Debugger** | `debugger.agent.md` | Causal analysis, root cause, cross-file tracing | Complex bugs, crashes, mysteries |

---

## CRITICAL WARNINGS (SACRED RULES)

### W-001: DATABASE MIGRATION STATUS
```
MIGRATED: PostgreSQL → MongoDB (COMPLETE)
DANGER: Many route files STILL contain broken query() calls
BROKEN: query() from database.js returns EMPTY results — always
FIX: Use Mongoose models: const { User, Conversation } = require('../config/database')
KNOWN BROKEN: server/routes/subscriptions.js
DETECT: grep -rn "query(" server/routes/ --include="*.js"
```

### W-002: AUTH STATE MANAGEMENT
```
AuthContext = READ-ONLY mirror of Redux store
NEVER: separate useState for user/token/isAuthenticated in AuthContext
ALWAYS: single useEffect with [] deps for initialization
ALWAYS: useSelector(selectUser) to read auth state in components
ACTION: dispatch(validateStoredToken()) on mount
```

### W-003: MARKETPLACE SELF-EXCLUSION
```
EVERY marketplace/feed view MUST exclude the logged-in user
PATTERN: if (currentUser?.id === profile.id) return null → .filter(Boolean)
VIOLATION: User seeing themselves in browse results
```

### W-004: API RESPONSE CONTRACT
```
ALWAYS: { success: boolean, data: any, message: string }
NEVER: Raw data, inconsistent shapes, or missing success field
EVERY: Error response also follows this shape with success: false
```

### W-005: ERROR RESPONSE SAFETY
```
DEVELOPMENT: error.message (detailed for debugging)
PRODUCTION: 'Internal server error' (NEVER leak stack traces/internals)
PATTERN: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
```

---

## ARCHITECTURE MAP

### Backend Service Injection (Available in ALL routes via `req.*`)
```
req.trustEngine              → Trust scoring, event recording, threshold checks
req.escrowManager            → Escrow creation, release, dispute, refund
req.fraudDetection           → Risk assessment: { riskLevel, factors }
req.countryManager           → IP → country resolution, currency mapping
req.currencyManager          → Multi-currency conversion, formatting
req.locationTrackingService  → Real-time user location updates
req.recommendationEngine     → Uber/Bolt-style profile matching (MongoRecommendationEngine)
req.conversationService      → Chat CRUD, message storage, participant management
req.cloudinaryManager        → Cloud image/file upload, transformation
req.notificationService      → Push/in-app notifications via socket
req.subscriptionManager      → Subscription lifecycle, tier checks
req.userConnectionManager    → Follow/block/connect user relationships
req.io                       → Socket.io server instance for real-time emit
```

### Recommendation Algorithm (Uber/Bolt Style)
```
Step 1: Account Type Filter → clients see providers, providers see clients
Step 2: Country Match       → same country first (weight: 0.30)
Step 3: Distance Proximity  → closest first (weight: 0.25)
Step 4: Quality Factors     → verification, ratings (weight: 0.15)
Step 5: Freshness           → recently online (weight: 0.10)
Step 6: Engagement          → response rate, success rate (weight: 0.10)
Step 7: Beauty              → profile completeness (weight: 0.05)
Step 8: Popularity          → reviews, bookings (weight: 0.05)
Implementation: server/services/MongoRecommendationEngine.js
```

### Frontend State Flow
```
localStorage('token')
  → AuthContext (single useEffect, [] deps)
  → Redux dispatch(validateStoredToken())
  → authSlice: { user, token, isAuthenticated, isSubscribed, verificationTier }
  → Components via useSelector(selectUser), useSelector(selectIsAuthenticated)
```

### Socket.io Room Architecture
```
user_${userId}                 → Personal (notifications, status, DMs)
conversation_${conversationId} → Chat (message broadcast, typing indicators)
call_${userId1}_${userId2}     → Video/voice (WebRTC signaling)
```

### Request Lifecycle
```
INGRESS → helmet → cors → rateLimit → bodyParser → cookieParser
  → serviceInjection (14 services attached to req)
  → [per-route] authMiddleware → requireSubscription
  → HANDLER
  → { success, data, message } response
  → [side-effects] trust events, socket emits, notifications
```

---

## FILE STRUCTURE

```
Zerohook/
├── server/
│   ├── index.js                           ← Express + Socket.io entry (1222 lines)
│   ├── config/
│   │   └── database.js                    ← MongoDB + Mongoose models (User, Conversation)
│   ├── routes/ (25 files)
│   │   ├── auth.js                        ← Registration, login, token validation
│   │   ├── users.js                       ← Profile CRUD, marketplace browse
│   │   ├── chat.js                        ← Conversations, messages, file uploads
│   │   ├── services.js                    ← Service marketplace CRUD
│   │   ├── payments.js                    ← Paystack, Stripe, wallet
│   │   ├── subscriptions.js               ← ⚠️ BROKEN (PostgreSQL legacy)
│   │   ├── trust.js                       ← Trust score queries
│   │   ├── reputation.js                  ← Reputation management
│   │   ├── verification.js                ← Identity verification
│   │   ├── escrow.js                      ← Escrow transactions
│   │   ├── notifications.js               ← Notification management
│   │   ├── calls.js                       ← Video/voice call management
│   │   ├── bookings.js                    ← Booking lifecycle
│   │   ├── uploads.js                     ← File upload handling
│   │   ├── dashboard.js                   ← User dashboard data
│   │   ├── countries.js                   ← Country/currency data
│   │   ├── geolocation.js                 ← Location services
│   │   ├── userConnections.js             ← Social connections
│   │   ├── adultServices.js               ← Adult service marketplace
│   │   ├── privacy.js                     ← Privacy controls
│   │   ├── transactions.js                ← Transaction records
│   │   ├── milestone.js                   ← Milestone tracking
│   │   ├── sugarAccess.js                 ← Sugar access tiers
│   │   ├── admin.js                       ← Admin dashboard
│   │   └── status.js                      ← Health check
│   ├── services/ (15+ classes)
│   │   ├── TrustEngine.js                 ← Trust scoring + event recording
│   │   ├── FraudDetection.js              ← Risk assessment engine
│   │   ├── EscrowManager.js               ← Escrow transaction lifecycle
│   │   ├── MongoRecommendationEngine.js   ← Uber/Bolt matching (ACTIVE)
│   │   ├── RecommendationEngine.js        ← DEPRECATED (PostgreSQL)
│   │   ├── ConversationService.js         ← Chat conversation management
│   │   ├── CountryManager.js              ← IP → country detection
│   │   ├── CurrencyManager.js             ← Multi-currency support
│   │   ├── CloudinaryManager.js           ← Cloud file storage
│   │   ├── NotificationService.js         ← Push/in-app notifications
│   │   ├── SystemHealthService.js         ← System health monitoring
│   │   ├── PerformanceMetrics.js          ← Performance tracking
│   │   ├── PrivacyManager.js              ← GDPR privacy controls
│   │   ├── LocationTrackingService.js     ← Real-time location
│   │   └── ... (more specialized services)
│   ├── middleware/
│   │   ├── performanceMonitoring.js       ← Request timing
│   │   └── requireSubscription.js         ← Subscription tier gates
│   └── tests/
│       ├── chatIntegration.test.js        ← Chat API tests
│       └── conversationService.test.js    ← ConversationService tests
├── client/
│   └── src/
│       ├── pages/ (34+ components)
│       │   ├── ProfileFeed.jsx            ← Marketplace browse
│       │   ├── MessagesPage.jsx           ← Chat interface
│       │   ├── DashboardPage.jsx          ← User dashboard
│       │   └── ... (31+ more)
│       ├── components/                    ← Reusable feature components
│       ├── store/
│       │   └── authSlice.js               ← Auth state (single source of truth)
│       ├── contexts/
│       │   ├── AuthContext.js             ← Auth initialization (reads Redux)
│       │   └── SocketContext.js           ← Socket.io connection management
│       └── services/                      ← API service layer
├── CLAUDE.md                              ← This file (project memory)
├── .github/
│   └── copilot-instructions.md            ← Detailed project documentation
└── .claude/
    └── agents/ (8 specialist agents)
        ├── claudecode.agent.md            ← ZH-Nexus (Master Orchestrator)
        ├── backend.agent.md               ← ZH-Backend
        ├── frontend.agent.md              ← ZH-Frontend
        ├── database.agent.md              ← ZH-Database
        ├── security.agent.md              ← ZH-Security
        ├── realtime.agent.md              ← ZH-Realtime
        ├── devops.agent.md                ← ZH-DevOps
        └── debugger.agent.md              ← ZH-Debugger
```

---

## FAILURE MODE CATALOG

| ID | Name | Detection | Impact | Auto-Fix |
|----|------|-----------|--------|----------|
| FM-001 | PostgreSQL Ghost | `query()` in route files | Empty data returned | Migrate to Mongoose |
| FM-002 | Auth Race | Multiple auth useEffects | Login failures, flickering | Single useEffect + [] deps |
| FM-003 | Socket Orphan | `.on()` without `.off()` | Memory leak, duplicate events | Add cleanup in useEffect return |
| FM-004 | Trust Blindspot | Action without trust event | Trust score inaccurate | Add recordTrustEvent call |
| FM-005 | Self-Inclusion | No self-filter in feed | User sees self in marketplace | Add ID exclusion filter |
| FM-006 | Error Leak | No env check in catch | Internal details exposed | Add env-aware error message |
| FM-007 | Middleware Gap | Route without authMiddleware | Unauthenticated access | Add authMiddleware |
| FM-008 | Response Mismatch | Raw data without wrapper | Frontend parsing failures | Wrap in { success, data, message } |
| FM-009 | Circular Import | A→B→A dependency | Module loading crash | Restructure imports |
| FM-010 | N+1 Query | DB call in loop | Exponential latency | Use $in or batch query |
| FM-011 | Room Leak | Join without leave | Memory growth | Add leave on disconnect |
| FM-012 | Stale Closure | Old value in callback | Wrong data in handler | useRef or functional setState |
| FM-013 | Index Miss | Unindexed query field | Slow collection scan | Add Mongoose index |
| FM-014 | Subscription Bypass | No requireSubscription | Premium leak | Add middleware |
| FM-015 | File Type Bypass | No upload validation | Security risk | Add type/size whitelist |

---

## MONGODB QUICK REFERENCE

```javascript
const { User, Conversation, connectDB } = require('../config/database');

// === CRUD ===
User.findById(id)                                             // By ID
User.findOne({ email })                                       // By field
User.find({ account_type: 'provider', is_active: true })      // Multiple
new User(data).save()                                         // Create
User.findByIdAndUpdate(id, { $set: fields }, { new: true })   // Update
User.findByIdAndDelete(id)                                    // Delete
User.countDocuments({ is_active: true })                      // Count

// === PERFORMANCE ===
User.find(query).lean()                       // Read-only (skip hydration)
User.find(query).select('username email')     // Projection (limit fields)
User.find(query).sort({ created_at: -1 }).limit(20)  // Sort + limit
User.aggregate([...pipeline])                 // Complex queries

// === NEVER ===
// query('SELECT * FROM users WHERE id = $1', [id])  ← BROKEN, returns empty
```

---

## SESSION INTELLIGENCE

### Session Log Format
```
[TASK]   Brief description
[AGENT]  Which specialist handled it
[FILES]  Files read → files modified
[FM]     Failure modes encountered (FM-XXX)
[STATUS] Complete | In Progress | Blocked
[LEARN]  Key discoveries, patterns, or decisions
```

### Progressive Memory Layers
```
Layer 0 — Genome:    Immutable platform DNA (this file)
Layer 1 — Skeleton:  Architecture map (routes, services, pages)
Layer 2 — Nervous:   Runtime dependency graph (built per session)
Layer 3 — Muscle:    Session context (files read, changes made, tests run)
Layer 4 — Intuition: Learned patterns (accumulated across tasks)
```

---

*ZH-Nexus sees this platform as a living organism — 25 routes as arteries, 15 services as organs, 34 pages as nerve endings, Socket.io as the nervous system, MongoDB as memory. Every change ripples through the whole body.*
