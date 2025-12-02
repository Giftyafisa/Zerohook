# Zerohook Platform - AI Coding Agent Instructions

## Project Overview
Zerohook is a secure adult service marketplace with advanced fraud detection, multi-tier trust scoring, and blockchain-based escrow. Built with React/Redux frontend and Node.js/Express backend, targeting African markets with Paystack integration.

## Architecture Patterns

### Service-Oriented Backend
- **Core Services**: `TrustEngine`, `EscrowManager`, `FraudDetection`, `PaystackManager` injected into `req` object
- **Service Pattern**: All business logic in `/server/services/`, routes are thin wrappers
- **Middleware Chain**: Rate limiting → Auth → Service injection → Route handlers

```js
// Services available in all routes via middleware
req.trustEngine.recordTrustEvent(userId, 'login', metadata, trustImpact);
req.escrowManager.createEscrow(transactionData);
req.fraudDetection.assessRisk(userAction);
# Zerohook Platform – AI Coding Agent Instructions
   - Authentication: Login → Verify subscription status in navbar → Check user exclusion from browse
   - Navigation: Test all navigation links → Verify protected routes → Check error boundaries
   - Communication: Contact button → Connection request → Chat system → Real-time messaging
   - Subscription: Subscription badges visible → User differentiation clear → Premium features restricted
   - Responsive: Mobile breakpoints → Touch interactions → All screen sizes functional
// Critical testing checkpoints for each component
// AuthContext.js - Test authentication initialization

// ProtectedRoute.js - Check route protection logic
### API Response Pattern
```js
  message: 'Operation completed'
});
```

### Authentication Flow
- **JWT Tokens**: Include `userId`, `username`, `verificationTier` in payload
- **Token Validation**: `authMiddleware` enriches `req.user` with subscription data
- **Real-time Auth**: Socket.io uses JWT for authentication, stores `userId` and `username`

### JSONB Data Patterns
```js
// User profile_data structure
profile_data: {
  firstName, lastName, age, location: { city, country, coordinates },
  basePrice, availability: [], specializations: [], languages: []
}

// Service location_data and requirements
location_data: { type: 'flexible|fixed', coordinates, address }
- **Subscription Updates**: Use `setSubscriptionStatus()` action after user data changes
```js
// CORRECT: AuthContext reads from Redux, never maintains separate state
const isAuthenticated = useSelector(selectIsAuthenticated);
const user = useSelector(selectUser);

// INCORRECT: Don't maintain separate authentication state in AuthContext
// const [localUser, setLocalUser] = useState(null); // ❌ Never do this
```

### Component Architecture
- **Page Components**: In `/src/pages/`, handle routing and high-level state
- **Feature Components**: Reusable business logic (e.g., `UserConnectionHub`)
- **Layout Components**: `Navbar`, `Footer` with responsive design
- **Production Patterns**: Always filter logged-in users from marketplace results, implement subscription differentiation
- **Error Handling**: Use `ErrorBoundary` for all route components, toast notifications for user feedback
- **Mobile Optimization**: Touch-friendly interactions, responsive breakpoints, proper viewport handling

### Error Handling Pattern
- **Backend**: Use try/catch with environment-aware error messages: `process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'`
- **Frontend**: `ErrorBoundary` wraps all routes, toast notifications for user feedback
- **Database**: All queries use parameterized statements via `query()` function
- **API Responses**: Always include `status`, `data`, and conditional error details
- **Investigation Protocol**: Read complete file chains - never debug single files in isolation

## Critical Chat & Communication System

### Chat System Architecture
- **Backend Routes**: `/api/chat/` with conversation management, message sending, file uploads
- **Database Schema**: `conversations` (participant1_id, participant2_id), `messages` (conversation_id, sender_id, content)
- **Real-time Delivery**: Socket.io rooms for conversation-based message broadcasting
- **File Handling**: Multipart file uploads with metadata storage in message JSON

```js
// Chat API pattern
router.post('/send', authMiddleware, async (req, res) => {
  // Insert message, update conversation, emit via socket.io
  req.io.to(`conversation_${conversationId}`).emit('new_message', messageData);
});
```

### Video Call Integration
- **Call Signaling**: Socket.io events for `call_request`, `incoming_call`, `call_accepted`
- **Room Management**: Dynamic call rooms `call_${userId1}_${userId2}`
- **Video Component**: `VideoSystem` component handles WebRTC integration
- **Call States**: Request → Ringing → Active → Ended/Cancelled


### Payment System
- **Primary**: Paystack for African markets (Nigeria, Ghana, Kenya, etc.)
- **Secondary**: Stripe for international users
- **Crypto**: Ethereum/Polygon integration via `CryptoPaymentManager`

### Real-time Features
- **Socket.io**: User connections, chat, notifications, video calls
- **Context Pattern**: `SocketProvider` wraps app, accessible via `useSocket()`
- **Authentication**: Socket.io uses JWT middleware for secure connections
- **Room Management**: Users auto-join `user_${userId}` rooms, conversation rooms `conversation_${conversationId}`
- **Event Patterns**: `typing_start/stop`, `new_message`, `call_request/accept/reject`, `user_status`

```js
// Socket.io event handling pattern
socket.on('join_conversation', (conversationId) => {
  socket.join(`conversation_${conversationId}`);
});

// Real-time message delivery
req.io.to(`conversation_${conversationId}`).emit('new_message', messageData);
```

### File Uploads
- **Storage**: Local filesystem `/uploads/` directory
- **Validation**: File type and size validation in `uploadRoutes`
- **Access**: Static files served via Express at `/uploads` endpoint

## Security Considerations

### Rate Limiting
- Applied to all `/api/*` routes except auth and subscriptions
- Configurable via `RATE_LIMIT_*` environment variables

### Trust System Integration
- All user actions should trigger trust events: `recordTrustEvent(userId, action, metadata, impact)`
- Fraud detection runs on registration, login, and transaction creation
- Reputation scores affect service visibility and trust ratings

### Data Privacy
- JSONB `profile_data` for flexible user information
- Privacy controls via `PrivacyManager` service
- GDPR compliance features built-in

## Production Deployment & Wireup Patterns

### Authentication State Management (Critical Pattern)
- **Race Condition Prevention**: Single `useEffect` in `AuthContext.js` for initialization, avoid multiple auth state updates
- **Token Validation**: Use `validateStoredToken()` Redux action for consistent auth state
- **Subscription Status**: Separate effect for subscription status updates, depends on user data availability
- **State Synchronization**: AuthContext reads from Redux store, never maintains separate state

```js
// PROVEN PATTERN: AuthContext.js single initialization effect
useEffect(() => {
  const initializeAuth = async () => {
    const token = localStorage.getItem('token');
    if (token && !user) {
      try {
        await dispatch(validateStoredToken()).unwrap();
      } catch (error) {
        localStorage.removeItem('token');
      }
    }
  };
  initializeAuth();
}, []); // CRITICAL: Only run once on mount
```

### User Profile Filtering (Production Essential)
- **Self-Exclusion Logic**: Always filter logged-in user from marketplace results
- **Subscription Differentiation**: Include `subscriptionStatus`, `subscriptionTier`, `isPremium` fields
- **Data Processing**: Robust error handling for malformed profile data, use `.filter(Boolean)` to remove nulls

```js
// CRITICAL: Logged-in user exclusion pattern
if (isAuthenticated && currentUser && currentUser.id === user.id) {
  console.log('🚫 Skipping logged-in user profile:', user.username);
  return null; // Filtered out by .filter(Boolean)
}
```

### Protected Route Architecture
- **Two-Tier Protection**: `requireSubscription={false}` for basic auth, `true` for premium features
- **Navigation State**: Preserve intended destination in `location.state.from` for post-login redirect
- **Error Boundaries**: Wrap all route components in `<ErrorBoundary>` for crash protection

### Real-time Communication Patterns
- **Socket Room Management**: Auto-join `user_${userId}` and `conversation_${conversationId}` rooms
- **Message Broadcasting**: Use `req.io.to(roomId).emit()` for targeted delivery
- **Typing Indicators**: Implement with timeout cleanup to prevent stuck states
- **Connection Stability**: Handle socket disconnection/reconnection gracefully

## Critical Debugging & Investigation Protocols

### Production Wireup Debugging Methodology
1. **Systematic Phase Approach**: Fix authentication → navigation → communication → subscription → responsive design
2. **Immediate Testing**: Test each fix in browser before proceeding to next change
3. **Console Validation**: Use browser dev tools to verify state changes and API responses
4. **Component Isolation**: Test individual components independently before integration
5. **Mobile Testing**: Verify touch interactions and responsive breakpoints at each phase

### Authentication Race Condition Debugging
1. **State Flow**: Monitor Redux DevTools for auth action sequences
2. **Token Lifecycle**: Check localStorage token presence vs Redux user state
3. **Initialization Order**: Verify AuthContext → Redux → Component mounting sequence
4. **Subscription Sync**: Confirm subscription status updates after user data loads
5. **Common Issues**: Multiple `useEffect` calls, stale closure dependencies, async timing

### User Interface State Debugging
1. **Profile Filtering**: Verify logged-in user ID exclusion in network requests
2. **Subscription Badges**: Check data flow from backend user object to UI display
3. **Contact Buttons**: Trace authentication state → button enabled/disabled logic
4. **Route Protection**: Monitor navigation events and redirect behavior
5. **Component Props**: Use React DevTools to inspect prop drilling and state updates

### Deep Investigation Methodology (NO GUESSWORK)
1. **Read ALL Related Files**: Never debug in isolation - examine complete file chains
2. **Map File Flow Dependencies**: Trace data/function calls across entire component tree
3. **Precise Error Identification**: Use exact error messages, stack traces, and line numbers
4. **Cross-Reference Analysis**: Check all files that import/export the failing components
5. **Systematic File Review**: Read implementation details, not just surface-level code

### Database Issues Investigation
1. **File Flow**: `database.js` → `query()` calls → route handlers → service layers
2. **Read Files**: Connection config, pool settings, all query implementations
3. **Check Scripts**: `node test-db-connection.js`, latest `fix-database-*.js`
4. **Verify Schema**: `check-all-tables.js`, compare expected vs actual structure
5. **Related Errors**: Check for connection pool exhaustion, SSL issues, timeout configs

### Authentication Problems Investigation  
1. **File Flow**: `AuthContext.js` → `authSlice.js` → `authMiddleware` → token validation
2. **Read Files**: JWT generation, token storage, refresh logic, middleware chain
3. **Environment Check**: JWT_SECRET, token expiration, storage mechanisms
4. **Cross-Component**: Redux state, localStorage, API interceptors, protected routes
5. **Related Errors**: Token expiry, middleware bypass, state synchronization issues

### Service Integration Investigation
1. **File Flow**: `index.js` service injection → middleware → route handlers → service methods
2. **Read Files**: Service constructors, initialization order, dependency injection patterns
3. **Health Monitoring**: Service startup logs, `/api/health` responses, initialization failures
4. **Integration Points**: Service method calls, error propagation, async operation handling
5. **Related Errors**: Service initialization race conditions, circular dependencies, async failures

### Chat & Real-time Communication Investigation
1. **File Flow**: `ChatSystem.js` → Socket events → `/api/chat/` routes → database → Socket.io broadcast
2. **Read Files**: Socket event handlers, chat routes, conversation components, video call integration
3. **Message Flow**: Frontend input → API validation → Database storage → Real-time broadcast
4. **State Management**: Local message state, conversation list, socket connection status
5. **Related Errors**: Socket disconnection, message delivery failures, conversation sync issues

### Frontend State & Error Boundary Investigation
1. **File Flow**: `App.js` → `ErrorBoundary` → Route components → Redux state → API calls
2. **Read Files**: Error boundary implementation, global error handlers, Redux slices, API service files
3. **Error Capture**: Component crashes, API failures, network errors, authentication failures
4. **Recovery Patterns**: Retry mechanisms, fallback UI, error logging, user feedback
5. **Related Errors**: Component rendering failures, state corruption, navigation errors

## Performance Optimization

### Database Indexes
- User lookups: `idx_users_email`, `idx_users_verification_tier`
- Service queries: `idx_services_provider_id`, `idx_services_category_id`
- Location searches: GIN index on `location_data` JSONB
- Profile data: GIN index on `profile_data` for complex queries

### Caching Strategy
- Redis integration available but optional
- Service results cached in memory for short periods
- Static file serving optimized via Express

Remember: This platform prioritizes user safety and trust - always consider fraud prevention and user verification in new features.
