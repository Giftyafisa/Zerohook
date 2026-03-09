const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { inferMessageType } = require('./utils/inferMessageType');
// Load environment variables based on NODE_ENV
const envPath = process.env.NODE_ENV === 'production' ? './env.production' : './env.local';
require('dotenv').config({ path: envPath });
console.log(`🔧 Loading environment from: ${envPath}`);
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
  if (process.env.NODE_ENV === 'test') {
    process.env.JWT_SECRET = 'test_jwt_secret_for_ci_only_min_32_chars';
    console.warn('⚠️ JWT_SECRET was missing/weak in test mode. Using test fallback secret.');
  } else {
    console.error('❌ JWT_SECRET is missing or too weak. Set a strong secret (min 32 chars).');
    process.exit(1);
  }
}
const jwt = require('jsonwebtoken');

const { router: authRoutes } = require('./routes/auth');
const userRoutes = require('./routes/users');
const serviceRoutes = require('./routes/services');
const escrowRoutes = require('./routes/escrow');
const reputationRoutes = require('./routes/reputation');
const trustRoutes = require('./routes/trust');
const adultServiceRoutes = require('./routes/adultServices');
const privacyRoutes = require('./routes/privacy');
const { router: chatRoutes } = require('./routes/chat');
const verificationRoutes = require('./routes/verification');
const transactionRoutes = require('./routes/transactions');
const paymentRoutes = require('./routes/payments');
const uploadRoutes = require('./routes/uploads');
const dashboardRoutes = require('./routes/dashboard');
const countryRoutes = require('./routes/countries');
const subscriptionRoutes = require('./routes/subscriptions');
const userConnectionRoutes = require('./routes/userConnections');
const notificationRoutes = require('./routes/notifications');
const callRoutes = require('./routes/calls');
const geolocationRoutes = require('./routes/geolocation');
const bookingsRoutes = require('./routes/bookings');
const milestoneRoutes = require('./routes/milestone');
const sugarAccessRoutes = require('./routes/sugarAccess');
const adminRoutes = require('./routes/admin');
const contentRoutes = require('./routes/content');

// Import services
const TrustEngine = require('./services/TrustEngine');
const FraudDetection = require('./services/FraudDetection');
const EscrowManager = require('./services/EscrowManager');
const CryptoPaymentManager = require('./services/CryptoPaymentManager');
const CountryManager = require('./services/CountryManager');
const CurrencyManager = require('./services/CurrencyManager');
const UserConnectionManager = require('./services/UserConnectionManager');
const ConversationService = require('./services/ConversationService');
const SystemHealthService = require('./services/SystemHealthService');
const MongoRecommendationEngine = require('./services/MongoRecommendationEngine');
const CloudinaryManager = require('./services/CloudinaryManager');
const RealtimeLocationManager = require('./services/RealtimeLocationManager');
const TikTokEngagementTracker = require('./services/TikTokEngagementTracker');
const SubscriptionLifecycleManager = require('./services/SubscriptionLifecycleManager');
const NotificationService = require('./services/NotificationService');
const mongoose = require('mongoose');
const { connectDB, connectRedis, User, Conversation, Call } = require('./config/database');

const app = express();
const server = createServer(app);

// Track critical service health
const serviceStatus = {
  db: false,
  redis: false
};

// Shared CORS origin list — used by both Express and Socket.io
const sharedAllowedOrigins = [
  process.env.CLIENT_URL,
  // Custom domain (Namecheap)
  'https://opue.me',
  'https://www.opue.me',
  // Render deployment URLs
  'https://zerohook.onrender.com',
  'https://zerohook-web.onrender.com',
  'https://zerohook-o58h.onrender.com',
  // Local development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:19006',
  'http://localhost:8081'
].filter(Boolean);

// Origin checker reused by both Express cors() and Socket.io
function isAllowedOrigin(origin) {
  if (!origin) return true; // Allow no-origin requests (mobile apps, curl, etc.)
  if (sharedAllowedOrigins.includes(origin)) return true;
  // Accept any zerohook*.onrender.com subdomain (handles Render's dynamic names)
  if (/^https:\/\/zerohook[\w-]*\.onrender\.com$/.test(origin)) return true;
  // Dev: any localhost port
  const isDev = (process.env.NODE_ENV || 'development') === 'development';
  if (isDev && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}

// Socket.io setup with CORS for web and mobile
const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      console.warn(`Socket.io CORS blocked origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});
// Socket.io authentication middleware (verify JWT on handshake)
// Accept token either in socket.handshake.auth.token or in socket.handshake.headers.authorization
io.use((socket, next) => {
  try {
    const auth = socket.handshake.auth || {};
    const headers = socket.handshake.headers || {};
    const tokenFromAuth = auth.token;
    const headerAuth = headers.authorization || headers.Authorization;
    const token = tokenFromAuth || (typeof headerAuth === 'string' && headerAuth.split(' ')[1]) || null;

    if (!token) {
      console.warn('Socket connection rejected - no token provided');
      return next(new Error('Authentication error'));
    }

    const jwtSecret = process.env.JWT_SECRET;
    let payload;
    let tokenSource = tokenFromAuth ? 'auth.token' : 'authorization header';
    try {
      payload = jwt.verify(token, jwtSecret);
      console.log(`🔑 Socket token verified from ${tokenSource}`);
    } catch (err) {
      console.warn(`Socket connection rejected - invalid token from ${tokenSource}:`, err.message);
      return next(new Error('Authentication error'));
    }

    // Attach user information to socket for handlers
    socket.userId = payload.userId || payload.id || null;
    socket.username = payload.username || payload.user || payload.name || 'unknown';

    if (!socket.userId) {
      console.warn('Socket connection rejected - token missing userId');
      return next(new Error('Authentication error'));
    }

    console.log(`✅ Socket authenticated: User ${socket.username} (${socket.userId})`);
    return next();
  } catch (error) {
    console.error('Socket auth middleware error:', error);
    return next(new Error('Authentication error'));
  }
});

// Middleware
// Configure Helmet with relaxed CORP for uploaded files
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin access to uploaded files
  crossOriginEmbedderPolicy: false // Disable COEP to allow embedding resources
}));

// Trust proxy for rate limiting behind reverse proxies (Render, Heroku, etc.)
app.set('trust proxy', 1);

// CORS configuration - reuses shared origin checker from above
app.use(cors({
  origin: function(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    console.warn(`CORS blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Performance monitoring middleware
const performanceMonitoring = require('./middleware/performanceMonitoring');
app.use(performanceMonitoring);

// Rate limiting - More lenient for development
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000, // 5 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500, // 500 requests per 5 minutes
  message: { success: false, error: 'Too many requests from this IP, please try again later.', retryAfter: '5 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }, // Disable X-Forwarded-For validation warning
  skip: (req) => {
    // Skip rate limiting only for health checks and country/geo detection
    const p = req.path || '';
    return p === '/api/health' ||
           p.startsWith('/api/health/') ||
           p.startsWith('/api/countries') ||
           p.startsWith('/api/geolocation/');
  }
});

// Apply rate limiting to all routes EXCEPT the skipped ones
app.use('/api/', (req, res, next) => {
  const p = req.path || '';
  // Skip rate limiting for infrastructure routes only
  if (p === '/health' || p.startsWith('/health/') ||
      p.startsWith('/countries') ||
      p.startsWith('/geolocation/')) {
    return next();
  }
  return limiter(req, res, next);
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Initialize services
const trustEngine = new TrustEngine();
const fraudDetection = new FraudDetection();
const escrowManager = new EscrowManager();
const cryptoPaymentManager = new CryptoPaymentManager();
const countryManager = new CountryManager();
const currencyManager = new CurrencyManager();
const userConnectionManager = new UserConnectionManager();
const recommendationEngine = new MongoRecommendationEngine();
const cloudinaryManager = new CloudinaryManager();
const LocationTrackingService = require('./services/LocationTrackingService');
const locationTrackingService = new LocationTrackingService();
const realtimeLocationManager = new RealtimeLocationManager();
const tiktokEngagementTracker = new TikTokEngagementTracker();
const subscriptionLifecycleManager = new SubscriptionLifecycleManager(cryptoPaymentManager, io);

// Initialize profile and location verification services (NEW)
const ProfileCompletenessService = require('./services/ProfileCompletenessService');
const LocationVerificationService = require('./services/LocationVerificationService');
const profileCompletenessService = new ProfileCompletenessService();
const locationVerificationService = new LocationVerificationService();
console.log('📋 Profile Completeness Service initialized');
console.log('📍 Location Verification Service initialized');

// Initialize health service
const systemHealth = new SystemHealthService();

// Initialize user monitoring services
const UserActivityMonitor = require('./services/UserActivityMonitor');
const PerformanceMetrics = require('./services/PerformanceMetrics');
const userActivityMonitor = new UserActivityMonitor();
const performanceMetrics = new PerformanceMetrics();
const conversationService = new ConversationService();
const ACTIVE_RINGING_WINDOW_MS = parseInt(process.env.CALL_RINGING_WINDOW_MS || '300000', 10);

// Initialize all services
const initializeRuntimeServices = async () => {
  try {
    const dbConnected = await connectDB();
    serviceStatus.db = Boolean(dbConnected);
    if (dbConnected) {
      console.log('✅ Database connected');
    } else {
      console.log('⚠️  Database connection failed');
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ FATAL: Cannot start production server without database. Exiting.');
        process.exit(1);
      }
      console.log('⚠️  Development mode: server will continue running without database for frontend testing');
    }
  } catch (error) {
    serviceStatus.db = false;
    console.error('❌ Database connection failed:', error);
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ FATAL: Cannot start production server without database. Exiting.');
      process.exit(1);
    }
    console.log('⚠️  Development mode: server will continue running without database for frontend testing');
  }

  try {
    const redisConnected = await connectRedis();
    serviceStatus.redis = Boolean(redisConnected);
    if (redisConnected) {
      console.log('✅ Redis connected');
    } else {
      console.log('⚠️  Redis not available, continuing without it');
    }
  } catch (error) {
    serviceStatus.redis = false;
    console.error('❌ Redis connection failed:', error);
    console.log('⚠️  Continuing without Redis - some features may be limited');
  }

  try {
    await trustEngine.initialize();
    console.log('✅ Trust Engine initialized');
  } catch (error) {
    console.error('❌ Trust Engine initialization failed:', error);
  }

  try {
    await fraudDetection.initialize();
    console.log('✅ Fraud Detection initialized');
  } catch (error) {
    console.error('❌ Fraud Detection initialization failed:', error);
  }

  try {
    await escrowManager.initialize();
    escrowManager.setIO(io); // Pass socket.io for auto-release notifications
    console.log('✅ Escrow Manager initialized');
  } catch (error) {
    console.error('❌ Escrow Manager initialization failed:', error);
  }

  try {
    await cryptoPaymentManager.initialize();
    console.log('✅ Crypto Payment Manager initialized');
  } catch (error) {
    console.error('❌ Crypto Payment Manager initialization failed:', error);
  }

  try {
    await currencyManager.initialize();
    console.log('✅ Currency Manager initialized');
  } catch (error) {
    console.error('❌ Currency Manager initialization failed:', error);
  }

  try {
    await countryManager.initialize();
    console.log('✅ Country Manager initialized');
  } catch (error) {
    console.error('❌ Country Manager initialization failed:', error);
  }

  try {
    await locationTrackingService.initialize();
    console.log('✅ Location Tracking Service initialized');
  } catch (error) {
    console.error('❌ Location Tracking Service initialization failed:', error);
  }

  try {
    realtimeLocationManager.initialize(io);
    console.log('✅ Realtime Location Manager initialized (Uber-style)');
  } catch (error) {
    console.error('❌ Realtime Location Manager initialization failed:', error);
  }

  try {
    await tiktokEngagementTracker.initialize();
    console.log('✅ TikTok Engagement Tracker initialized');
  } catch (error) {
    console.error('❌ TikTok Engagement Tracker initialization failed:', error);
  }

  try {
    await subscriptionLifecycleManager.initialize();
    console.log('✅ Subscription Lifecycle Manager initialized (payment monitoring + expiry cleanup)');
  } catch (error) {
    console.error('❌ Subscription Lifecycle Manager initialization failed:', error);
  }


  try {
    await userActivityMonitor.initialize();
    console.log('✅ User Activity Monitor initialized');
  } catch (error) {
    console.error('❌ User Activity Monitor initialization failed:', error);
  }

  try {
    await performanceMetrics.initialize();
    console.log('✅ Performance Metrics initialized');
  } catch (error) {
    console.error('❌ Performance Metrics initialization failed:', error);
  }
};

if (require.main === module) {
  initializeRuntimeServices();
}

// Make services available to routes
app.use((req, res, next) => {
  req.trustEngine = trustEngine;
  req.fraudDetection = fraudDetection;
  req.escrowManager = escrowManager;
  req.cryptoPaymentManager = cryptoPaymentManager;
  req.countryManager = countryManager;
  req.currencyManager = currencyManager;
  req.userActivityMonitor = userActivityMonitor;
  req.performanceMetrics = performanceMetrics;
  req.conversationService = conversationService;
  req.recommendationEngine = recommendationEngine;
  req.locationTrackingService = locationTrackingService;
  req.cloudinaryManager = cloudinaryManager;
  req.realtimeLocationManager = realtimeLocationManager;
  req.tiktokEngagementTracker = tiktokEngagementTracker;
  req.profileCompletenessService = profileCompletenessService;
  req.locationVerificationService = locationVerificationService;
  req.systemHealth = systemHealth;
  req.io = io;
  
  // Add database status to request for debugging
  req.dbAvailable = serviceStatus.db;
  
  next();
});

// Short-circuit requests if critical services are unavailable
app.use((req, res, next) => {
  const pathLower = (req.path || '').toLowerCase();
  const allowlist = [
    '/api/health',
    '/api/health/simple',
    '/api/status',
    '/api/status/health'
  ];

  // Allow uploads/static even if DB down so existing assets still serve
  const isUpload = pathLower.startsWith('/uploads');
  const isAllowed = allowlist.some((p) => pathLower.startsWith(p)) || isUpload;

  if (!serviceStatus.db && !isAllowed) {
    return res.status(503).json({
      status: 'unavailable',
      message: 'Database unavailable. Please try again shortly.',
      service: 'database'
    });
  }

  next();
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files from uploads directory with CORS headers
app.use('/uploads', (req, res, next) => {
  // Use the same allowed origins as the main CORS config instead of wildcard
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Allow direct browser navigation (no origin header)
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(uploadsDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api/reputation', reputationRoutes);
app.use('/api/trust', trustRoutes);
app.use('/api/adult-services', adultServiceRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/milestone', milestoneRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/countries', countryRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/connections', userConnectionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/geolocation', geolocationRoutes);
app.use('/api/sugar-access', sugarAccessRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/status', require('./routes/status'));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const healthStatus = await systemHealth.getDetailedStatus();
    res.json(healthStatus);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Simple health check for debugging
app.get('/api/health/simple', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Socket.io connection handling (authentication middleware moved to top)

io.on('connection', async (socket) => {
  console.log(`User ${socket.username} (${socket.userId}) connected:`, socket.id);

  // Use shared utility (single source of truth for message type inference)
  
  try {
    // Create user session and update presence
    const sessionToken = await userActivityMonitor.createUserSession(
      socket.userId, 
      socket.id, 
      socket.handshake.address, 
      socket.handshake.headers['user-agent']
    );

    // Broadcast online status to other users
    socket.broadcast.emit('user_status', {
      userId: socket.userId,
      username: socket.username,
      status: 'online',
      isOnline: true,
      timestamp: new Date().toISOString()
    });
    
    // Join user's personal room
    socket.join(`user_${socket.userId}`);
    
    // ===== UBER-STYLE REAL-TIME LOCATION EVENTS =====
    realtimeLocationManager.registerSocketHandlers(socket);
    
    // Handle user activity
    socket.on('user_activity', async (data) => {
      await userActivityMonitor.logUserActivity(socket.userId, {
        ...data,
        ipAddress: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      });
    });
    
    // ===== TIKTOK-STYLE ENGAGEMENT TRACKING =====
    socket.on('profile_engagement', async (data) => {
      const result = await tiktokEngagementTracker.trackProfileEngagement({
        userId: socket.userId,
        sessionId: socket.id,
        ...data
      });
      socket.emit('engagement_tracked', result);
    });
    
    // Handle typing indicators
    socket.on('typing_start', async (data) => {
      if (!data?.conversationId) return;
      const isMember = await conversationService.isMember(data.conversationId, socket.userId);
      if (!isMember) return;
      await userActivityMonitor.updateTypingStatus(socket.userId, true, data.conversationId);
      socket.to(`conversation_${data.conversationId}`).emit('typing_start', {
        userId: socket.userId,
        username: socket.username,
        conversationId: data.conversationId
      });
      // Backward compatibility for older clients
      socket.to(`conversation_${data.conversationId}`).emit('user_typing', {
        userId: socket.userId,
        username: socket.username,
        conversationId: data.conversationId
      });
    });
    
    socket.on('typing_stop', async (data) => {
      if (!data?.conversationId) return;
      const isMember = await conversationService.isMember(data.conversationId, socket.userId);
      if (!isMember) return;
      await userActivityMonitor.updateTypingStatus(socket.userId, false, data.conversationId);
      socket.to(`conversation_${data.conversationId}`).emit('typing_stop', {
        userId: socket.userId,
        username: socket.username,
        conversationId: data.conversationId
      });
    });
    
    // Handle page navigation
    socket.on('page_navigation', async (data) => {
      await userActivityMonitor.updateUserPage(socket.userId, data.page);
    });
    
    // Handle heartbeat/ping — keeps last_active fresh so recommendation engine
    // accurately marks users as online (hoursSinceActive < 1)
    socket.on('heartbeat', async () => {
      try {
        const now = new Date();
        // Primary: keep the User.last_active field current (used by recommendation engine)
        await User.findByIdAndUpdate(socket.userId, { last_active: now });
        // Secondary: refresh presence record
        await userActivityMonitor.updateUserPresence(socket.userId, 'online');
      } catch (heartbeatErr) {
        // Non-critical — don't crash for heartbeat failures
        if (process.env.NODE_ENV !== 'production') {
          console.error('Heartbeat error:', heartbeatErr.message);
        }
      }
    });
    
    // Handle existing room events
    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      console.log(`User ${socket.username} (${socket.userId}) joined room ${roomId}`);
    });

    socket.on('leave-room', (roomId) => {
      socket.leave(roomId);
      console.log(`User ${socket.username} (${socket.userId}) left room ${roomId}`);
    });

    // ===== CALL SYSTEM EVENTS =====
    
    // Normalize call room ID so both parties always join the same room
    function getCallRoomId(userId1, userId2) {
      const sorted = [String(userId1), String(userId2)].sort();
      return `call_${sorted[0]}_${sorted[1]}`;
    }

    // Handle call requests
    socket.on('call_request', async (data) => {
      try {
        if (!data?.targetUserId || String(data.targetUserId) === String(socket.userId)) {
          return;
        }
        console.log(`📞 Call request from ${socket.username} to user ${data.targetUserId}`);

        if (mongoose.Types.ObjectId.isValid(socket.userId) && mongoose.Types.ObjectId.isValid(data.targetUserId)) {
          const ringingCutoff = new Date(Date.now() - ACTIVE_RINGING_WINDOW_MS);
          const existingActiveCall = await Call.findOne({
            $or: [
              {
                status: 'connected',
                $or: [
                  { caller_id: socket.userId },
                  { target_user_id: socket.userId },
                  { caller_id: data.targetUserId },
                  { target_user_id: data.targetUserId }
                ]
              },
              {
                status: 'calling',
                created_at: { $gte: ringingCutoff },
                $or: [
                  { caller_id: socket.userId },
                  { target_user_id: socket.userId },
                  { caller_id: data.targetUserId },
                  { target_user_id: data.targetUserId }
                ]
              }
            ]
          }).select('_id status created_at').lean();

          if (existingActiveCall) {
            socket.emit('call_rejected', {
              id: String(existingActiveCall._id),
              callId: String(existingActiveCall._id),
              targetUserId: data.targetUserId,
              reason: 'busy',
              timestamp: new Date().toISOString()
            });
            return;
          }
        }

        let persistedCallId = Date.now().toString();
        if (mongoose.Types.ObjectId.isValid(socket.userId) && mongoose.Types.ObjectId.isValid(data.targetUserId)) {
          try {
            const callRow = await Call.create({
              caller_id: new mongoose.Types.ObjectId(socket.userId),
              target_user_id: new mongoose.Types.ObjectId(data.targetUserId),
              type: data.type === 'audio' ? 'audio' : 'video',
              status: 'calling',
              metadata: {
                source: 'socket',
                callerName: socket.username,
                socketId: socket.id
              }
            });
            persistedCallId = String(callRow._id);
          } catch (persistErr) {
            console.error('Failed to persist socket call request:', persistErr.message);
          }
        }
        
        // Emit incoming call to target user
        socket.to(`user_${data.targetUserId}`).emit('incoming_call', {
          id: persistedCallId,
          callId: persistedCallId,
          callerId: socket.userId,
          targetUserId: data.targetUserId,
          callerName: socket.username,
          type: data.type, // 'audio' or 'video'
          callType: data.type,
          timestamp: new Date().toISOString()
        });

        // Acknowledge caller with canonical call ID (used for timeout/cancel/end)
        socket.emit('call_request_sent', {
          id: persistedCallId,
          callId: persistedCallId,
          targetUserId: data.targetUserId,
          type: data.type,
          callType: data.type,
          timestamp: new Date().toISOString()
        });
        
        // Join call room (normalized)
        const callRoomId = getCallRoomId(socket.userId, data.targetUserId);
        socket.join(callRoomId);
        
      } catch (error) {
        console.error('Error handling call request:', error);
      }
    });

    // Handle call acceptance
    socket.on('accept_call', async (data) => {
      try {
        if (!data?.targetUserId || String(data.targetUserId) === String(socket.userId)) {
          return;
        }
        console.log(`✅ Call accepted by ${socket.username}`);

        let resolvedCallId = data.callId;
        if (data?.callId && mongoose.Types.ObjectId.isValid(data.callId)) {
          try {
            const updated = await Call.findOneAndUpdate(
              {
                _id: data.callId,
                target_user_id: socket.userId,
                status: 'calling'
              },
              {
                $set: {
                  status: 'connected',
                  connected_at: new Date(),
                  updated_at: new Date()
                }
              },
              { new: true }
            ).select('_id');
            if (updated?._id) {
              resolvedCallId = String(updated._id);
            }
          } catch (acceptPersistErr) {
            console.error('Failed to persist socket call accept:', acceptPersistErr.message);
          }
        }
        
        // Emit call accepted to caller
        socket.to(`user_${data.targetUserId}`).emit('call_accepted', {
          id: resolvedCallId,
          callId: resolvedCallId,
          targetUserId: socket.userId,
          peerUserId: socket.userId,
          callerId: data.targetUserId,
          callType: data.callType || data.type || 'video',
          timestamp: new Date().toISOString()
        });
        
        // Join call room (normalized)
        const callRoomId = getCallRoomId(socket.userId, data.targetUserId);
        socket.join(callRoomId);
        
      } catch (error) {
        console.error('Error handling call acceptance:', error);
      }
    });

    // Handle call rejection
    socket.on('reject_call', async (data) => {
      try {
        if (!data?.targetUserId || String(data.targetUserId) === String(socket.userId)) {
          return;
        }
        console.log(`❌ Call rejected by ${socket.username}`);

        if (data?.callId && mongoose.Types.ObjectId.isValid(data.callId)) {
          try {
            await Call.findOneAndUpdate(
              {
                _id: data.callId,
                target_user_id: socket.userId,
                status: 'calling'
              },
              {
                $set: {
                  status: 'rejected',
                  ended_at: new Date(),
                  updated_at: new Date()
                }
              }
            );
          } catch (rejectPersistErr) {
            console.error('Failed to persist socket call reject:', rejectPersistErr.message);
          }
        }
        
        // Emit call rejected to caller
        socket.to(`user_${data.targetUserId}`).emit('call_rejected', {
          id: data.callId,
          callId: data.callId,
          targetUserId: socket.userId,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('Error handling call rejection:', error);
      }
    });

    // Handle call ending
    socket.on('end_call', async (data) => {
      try {
        if (!data?.targetUserId) {
          return;
        }
        console.log(`📞 Call ended by ${socket.username}`);
        
        // Emit call ended to other participant.
        // The client sends targetUserId = the other person, but guard against
        // the edge case where targetUserId === socket.userId (self-reference)
        // by falling back to data.callerId if available.
        let otherUserId = data.targetUserId;
        if (String(otherUserId) === String(socket.userId) && data.callerId) {
          otherUserId = data.callerId;
        }

        if (data?.callId && mongoose.Types.ObjectId.isValid(data.callId)) {
          try {
            const existingCall = await Call.findOne({ _id: data.callId }).select('connected_at');
            const endedAt = new Date();
            const durationSec = existingCall?.connected_at
              ? Math.max(0, Math.floor((endedAt.getTime() - new Date(existingCall.connected_at).getTime()) / 1000))
              : 0;

            await Call.findOneAndUpdate(
              {
                _id: data.callId,
                $or: [
                  { caller_id: socket.userId },
                  { target_user_id: socket.userId }
                ],
                status: { $in: ['calling', 'connected'] }
              },
              {
                $set: {
                  status: 'ended',
                  ended_at: endedAt,
                  duration: durationSec,
                  updated_at: endedAt
                }
              }
            );
          } catch (endPersistErr) {
            console.error('Failed to persist socket call end:', endPersistErr.message);
          }
        }

        const endPayload = {
          id: data.callId,
          callId: data.callId,
          endedBy: socket.userId,
          timestamp: new Date().toISOString()
        };

        // Primary: emit to the other user's personal room
        socket.to(`user_${otherUserId}`).emit('call_ended', endPayload);

        // Secondary: also broadcast to the call room as a redundant delivery
        // path in case the user_${id} room has a stale socket reference.
        const callRoomId = getCallRoomId(socket.userId, otherUserId);
        socket.to(callRoomId).emit('call_ended', endPayload);
        socket.leave(callRoomId);
        
      } catch (error) {
        console.error('Error handling call end:', error);
      }
    });

    // Handle call cancellation
    socket.on('cancel_call', async (data) => {
      try {
        if (!data?.targetUserId || String(data.targetUserId) === String(socket.userId)) {
          return;
        }
        console.log(`🚫 Call cancelled by ${socket.username}`);

        if (data?.callId && mongoose.Types.ObjectId.isValid(data.callId)) {
          try {
            await Call.findOneAndUpdate(
              {
                _id: data.callId,
                caller_id: socket.userId,
                status: 'calling'
              },
              {
                $set: {
                  status: 'missed',
                  ended_at: new Date(),
                  updated_at: new Date()
                }
              }
            );
          } catch (cancelPersistErr) {
            console.error('Failed to persist socket call cancel:', cancelPersistErr.message);
          }
        }
        
        // Emit call cancelled to target user
        socket.to(`user_${data.targetUserId}`).emit('call_cancelled', {
          id: data.callId,
          callId: data.callId,
          callerId: socket.userId,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('Error handling call cancellation:', error);
      }
    });

    // Handle call timeout (caller gave up after 30s)
    socket.on('call_timeout', async (data) => {
      try {
        if (!data?.targetUserId || String(data.targetUserId) === String(socket.userId)) {
          return;
        }
        console.log(`⏰ Call timeout from ${socket.username}`);

        if (data?.callId && mongoose.Types.ObjectId.isValid(data.callId)) {
          try {
            await Call.findOneAndUpdate(
              {
                _id: data.callId,
                caller_id: socket.userId,
                status: 'calling'
              },
              {
                $set: {
                  status: 'missed',
                  ended_at: new Date(),
                  updated_at: new Date()
                }
              }
            );
          } catch (timeoutPersistErr) {
            console.error('Failed to persist socket call timeout:', timeoutPersistErr.message);
          }
        }

        socket.to(`user_${data.targetUserId}`).emit('call_cancelled', {
          id: data.callId,
          callId: data.callId,
          callerId: socket.userId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error handling call timeout:', error);
      }
    });

    // ===== WebRTC SIGNALING EVENTS (for video/audio calls) =====
    
    // Handle WebRTC offer from caller
    socket.on('webrtc_offer', async (data) => {
      try {
        if (!data?.targetUserId || String(data.targetUserId) === String(socket.userId) || !data?.offer) {
          return;
        }
        console.log(`📡 WebRTC offer from ${socket.username} to user ${data.targetUserId}`);
        socket.to(`user_${data.targetUserId}`).emit('webrtc_offer', {
          offer: data.offer,
          callerId: socket.userId,
          callerName: socket.username,
          callType: data.callType || 'video'
        });
      } catch (error) {
        console.error('Error handling WebRTC offer:', error);
      }
    });

    // Handle WebRTC answer from callee
    socket.on('webrtc_answer', async (data) => {
      try {
        if (!data?.targetUserId || String(data.targetUserId) === String(socket.userId) || !data?.answer) {
          return;
        }
        console.log(`📡 WebRTC answer from ${socket.username} to user ${data.targetUserId}`);
        socket.to(`user_${data.targetUserId}`).emit('webrtc_answer', {
          answer: data.answer,
          answererId: socket.userId
        });
      } catch (error) {
        console.error('Error handling WebRTC answer:', error);
      }
    });

    // Handle ICE candidate exchange
    socket.on('ice_candidate', async (data) => {
      try {
        if (!data?.targetUserId || String(data.targetUserId) === String(socket.userId) || !data?.candidate) {
          return;
        }
        console.log(`🧊 ICE candidate from ${socket.username} to user ${data.targetUserId}`);
        socket.to(`user_${data.targetUserId}`).emit('ice_candidate', {
          candidate: data.candidate,
          senderId: socket.userId
        });
      } catch (error) {
        console.error('Error handling ICE candidate:', error);
      }
    });

    // ===== CHAT SYSTEM EVENTS =====
    
    // Handle joining conversation room
    socket.on('join_conversation', async (conversationPayload) => {
      try {
        const conversationId = typeof conversationPayload === 'object'
          ? conversationPayload?.conversationId
          : conversationPayload;
        if (!conversationId) {
          socket.emit('join_error', { error: 'conversationId is required' });
          return;
        }

        // Verify membership via ConversationService
        const isMember = await conversationService.isMember(conversationId, socket.userId);
        if (!isMember) {
          socket.emit('join_error', { error: 'Access denied to this conversation' });
          return;
        }

        // Verify not blocked
        const otherUserId = await conversationService.getOtherParticipant(conversationId, socket.userId);
        if (otherUserId) {
          const blocked = await conversationService.isBlockedBetween(socket.userId, otherUserId);
          if (blocked) {
            socket.emit('join_error', { error: 'Conversation is blocked' });
            return;
          }
        }

        socket.join(`conversation_${conversationId}`);
        console.log(`User ${socket.username} joined conversation ${conversationId}`);
      } catch (err) {
        console.error('Error during join_conversation check:', err);
        socket.emit('join_error', { error: 'Failed to join conversation' });
      }
    });

    // Handle leaving conversation room
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation_${conversationId}`);
      console.log(`User ${socket.username} left conversation ${conversationId}`);
    });

    // Handle message read receipts
    socket.on('mark_read', async (data) => {
      try {
        if (!data?.conversationId) return;

        const isMember = await conversationService.isMember(data.conversationId, socket.userId);
        if (!isMember) {
          return;
        }

        const readPayload = {
          userId: socket.userId,
          username: socket.username,
          conversationId: data.conversationId,
          messageId: data.messageId,
          timestamp: new Date().toISOString()
        };

        socket.to(`conversation_${data.conversationId}`).emit('message_read', readPayload);

        const otherUserId = await conversationService.getOtherParticipant(data.conversationId, socket.userId);
        if (otherUserId) {
          io.to(`user_${otherUserId}`).emit('message_read', readPayload);
        }
      } catch (err) {
        console.error('Error handling mark_read:', err);
      }
    });

    // Handle sending messages (transactional + moderation)
    socket.on('send_message', async (data) => {
      const { conversationId, content, type, messageType, metadata = {} } = data || {};
      const resolvedMessageType = inferMessageType({ messageType, type, content, metadata });
      try {
        console.log(`💬 Message from ${socket.username} to conversation ${conversationId}`);

        const normalizedContent = String(content || '').trim();

        // Basic validation
        if (!conversationId || !normalizedContent) {
          console.warn(`Invalid message payload from ${socket.userId}`);
          return socket.emit('message_error', { error: 'Invalid message payload' });
        }
        if (normalizedContent.length > 2000) {
          return socket.emit('message_error', { error: 'Message too long (max 2000 characters)' });
        }

        // Verify membership
        const isMember = await conversationService.isMember(conversationId, socket.userId);
        if (!isMember) {
          console.warn(`Access denied: ${socket.userId} not member of conversation ${conversationId}`);
          return socket.emit('message_error', { error: 'Access denied to this conversation' });
        }

        const otherUserId = await conversationService.getOtherParticipant(conversationId, socket.userId);
        if (otherUserId) {
          const blocked = await conversationService.isBlockedBetween(socket.userId, otherUserId);
          if (blocked) {
            console.warn(`Blocked: ${socket.userId} cannot message ${otherUserId}`);
            return socket.emit('message_error', { error: 'Cannot send messages to this user' });
          }
        }

        // Content moderation via FraudDetection service
        try {
          if (fraudDetection && typeof fraudDetection.analyzeMessageRisk === 'function') {
            const mod = await fraudDetection.analyzeMessageRisk({ senderId: socket.userId, conversationId, content: normalizedContent, messageType: resolvedMessageType, metadata });
            const threshold = parseFloat(process.env.MESSAGE_RISK_BLOCK_THRESHOLD || '0.7');
            if (mod && typeof mod.score === 'number' && mod.score >= threshold) {
              console.warn(`Message blocked: Risk score ${mod.score} >= ${threshold}`);
              return socket.emit('message_blocked', { error: 'Message blocked due to policy violation' });
            }
          }
        } catch (modErr) {
          console.error('Socket moderation error:', modErr);
        }

        // Persist message via ConversationService with error handling
        let messageRow;
        try {
          messageRow = await conversationService.insertMessageTx({ conversationId, senderId: socket.userId, content: normalizedContent, messageType: resolvedMessageType, metadata });
        } catch (dbErr) {
          console.error('Database error inserting message:', dbErr);
          return socket.emit('message_error', { error: 'Database error, please try again' });
        }

        const messageData = {
          id: messageRow._id || messageRow.id,
          conversationId,
          senderId: socket.userId,
          senderName: socket.username,
          senderUsername: socket.username,
          content: normalizedContent,
          messageType: resolvedMessageType,
          metadata: messageRow.metadata || metadata || {},
          createdAt: messageRow.createdAt || messageRow.created_at,
          timestamp: messageRow.createdAt || messageRow.created_at
        };

        // Broadcast message after commit
        io.to(`conversation_${conversationId}`).emit('new_message', messageData);

        // Also emit to recipient's user room so they get it even when viewing a different conversation
        if (otherUserId) {
          io.to(`user_${otherUserId}`).emit('new_message', messageData);

          try {
            let preview;
            if (resolvedMessageType === 'image') preview = '📷 Photo';
            else if (resolvedMessageType === 'video') preview = '🎬 Video';
            else if (resolvedMessageType === 'file') preview = '📎 File';
            else if (resolvedMessageType === 'audio') preview = '🎵 Audio';
            else preview = normalizedContent.slice(0, 50);

            await NotificationService.createAndEmit(io, {
              userId: otherUserId,
              type: 'message',
              title: `New message from ${socket.username || 'Someone'}`,
              message: preview,
              data: { conversationId, senderId: socket.userId, messageId: String(messageData.id || '') }
            });
          } catch (notifErr) {
            console.error('Socket message notification error:', notifErr.message);
          }
        }

        // Log message activity (don't block on error)
        try {
          await userActivityMonitor.logUserActivity(socket.userId, {
            actionType: 'send_message',
            actionData: { conversationId, messageId: messageRow.id, contentLength: normalizedContent.length },
            ipAddress: socket.handshake.address,
            userAgent: socket.handshake.headers['user-agent'],
            responseTimeMs: 0,
            success: true
          });
        } catch (logErr) {
          console.error('Activity log error:', logErr.message);
        }

      } catch (error) {
        console.error('Error handling send_message:', error);
        socket.emit('message_error', { error: 'Failed to send message' });
      }
    });

    // Handle user status updates
    socket.on('update_status', async (data) => {
      try {
        await userActivityMonitor.updateUserStatus(socket.userId, data.status);
        
        // Broadcast status to all connected users
        socket.broadcast.emit('user_status', {
          userId: socket.userId,
          username: socket.username,
          status: data.status,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('Error updating user status:', error);
      }
    });

    // Handle user status requests (single user)
    // context: 'chat' (default) — requires conversation existence (privacy)
    // context: 'browse' / 'feed' — public marketplace, no conversation check
    socket.on('get_user_status', async (data) => {
      try {
        if (!data?.userId || String(data.userId) === String(socket.userId)) {
          return socket.emit('user_status', {
            userId: socket.userId,
            isOnline: true,
            lastSeen: null,
            status: 'online',
            timestamp: new Date().toISOString()
          });
        }

        const context = data?.context || 'chat';
        const isPublicContext = context === 'browse' || context === 'feed';

        // In chat context, require conversation for privacy
        if (!isPublicContext) {
          const canViewStatus = await Conversation.exists({
            $or: [
              { participant1Id: socket.userId, participant2Id: data.userId },
              { participant1Id: data.userId, participant2Id: socket.userId }
            ],
            status: { $ne: 'deleted' }
          });
          if (!canViewStatus) {
            return socket.emit('user_status', {
              userId: data.userId,
              isOnline: false,
              lastSeen: null,
              status: 'offline',
              timestamp: new Date().toISOString()
            });
          }
        }

        // Primary check: does the target user have an active socket connection?
        // This is the most reliable indicator — checking the socket.io room directly.
        const targetRoom = `user_${data.userId}`;
        const hasActiveSocket = (io.sockets.adapter.rooms.get(targetRoom)?.size || 0) > 0;
        
        // Fallback to activity monitor for lastSeen data
        let lastSeen = null;
        try {
          const userStatus = await userActivityMonitor.getUserStatus(data.userId);
          lastSeen = userStatus?.lastSeen || null;
        } catch (monitorErr) {
          // Non-critical — socket room check is the authority
        }
        
        // Emit status back to requesting user
        socket.emit('user_status', {
          userId: data.userId,
          isOnline: hasActiveSocket,
          lastSeen: lastSeen,
          status: hasActiveSocket ? 'online' : 'offline',
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('Error getting user status:', error);
        // Send default offline status
        socket.emit('user_status', {
          userId: data.userId,
          isOnline: false,
          lastSeen: null,
          status: 'offline',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle batched user status requests to avoid N socket round-trips
    // Supports two contexts:
    //   context: 'chat'   (default) — only returns status for users you have conversations with (privacy)
    //   context: 'browse' / 'feed' — returns real status for any user (public marketplace)
    socket.on('get_users_status', async (data) => {
      try {
        const requestedUserIds = Array.isArray(data?.userIds)
          ? [...new Set(data.userIds.map((id) => String(id || '').trim()).filter(Boolean))].slice(0, 200)
          : [];

        if (requestedUserIds.length === 0) {
          return socket.emit('users_status', { users: [] });
        }

        const context = data?.context || 'chat'; // 'chat' | 'browse' | 'feed'
        const isPublicContext = context === 'browse' || context === 'feed';

        // For chat context, apply conversation-based privacy filter
        let allowedUserSet = null;
        if (!isPublicContext) {
          const allowedConversations = await Conversation.find({
            $or: [
              { participant1Id: socket.userId, participant2Id: { $in: requestedUserIds } },
              { participant1Id: { $in: requestedUserIds }, participant2Id: socket.userId }
            ],
            status: { $ne: 'deleted' }
          }).select('participant1Id participant2Id').lean();

          allowedUserSet = new Set();
          allowedConversations.forEach((conversation) => {
            const p1 = String(conversation.participant1Id || '');
            const p2 = String(conversation.participant2Id || '');
            if (p1 !== String(socket.userId)) allowedUserSet.add(p1);
            if (p2 !== String(socket.userId)) allowedUserSet.add(p2);
          });
        }

        // ── Step 1: Determine online/offline via socket rooms (no DB needed) ──────────────
        const statusInfo = requestedUserIds.map((targetUserId) => {
          if (allowedUserSet && !allowedUserSet.has(targetUserId)) {
            return { userId: targetUserId, isOnline: false, blocked: true };
          }
          const roomSize = io.sockets.adapter.rooms.get(`user_${targetUserId}`)?.size || 0;
          return { userId: targetUserId, isOnline: roomSize > 0, blocked: false };
        });

        // ── Step 2: Batch-fetch last_active for offline users (single DB call) ──────────
        const offlineIds = statusInfo.filter(s => !s.isOnline && !s.blocked).map(s => s.userId);
        let lastActiveMap = {};
        if (offlineIds.length > 0) {
          try {
            const offlineUsers = await User.find({ _id: { $in: offlineIds } })
              .select('_id last_active lastActive').lean();
            offlineUsers.forEach(u => {
              lastActiveMap[String(u._id)] = u.last_active || u.lastActive || null;
            });
          } catch (_) { /* Non-critical — don't block for this */ }
        }

        // ── Step 3: Build human-readable label helper ────────────────────────────────────
        const getLastSeenLabel = (lastActiveDate) => {
          if (!lastActiveDate) return null;
          const diffMs = Date.now() - new Date(lastActiveDate).getTime();
          if (diffMs < 0) return null;
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMs / 3600000);
          const diffDays = Math.floor(diffMs / 86400000);
          if (diffMins < 5) return 'Just now';
          if (diffMins < 60) return `${diffMins}m ago`;
          if (diffHours < 24) return `${diffHours}h ago`;
          if (diffDays < 7) return `${diffDays}d ago`;
          return `${Math.floor(diffDays / 7)}w ago`;
        };

        const users = statusInfo.map(({ userId, isOnline, blocked }) => {
          const lastActiveRaw = isOnline ? null : (lastActiveMap[userId] || null);
          return {
            userId,
            isOnline,
            lastSeen: lastActiveRaw,
            lastSeenLabel: isOnline ? null : getLastSeenLabel(lastActiveRaw),
            status: blocked ? 'offline' : (isOnline ? 'online' : 'offline'),
          };
        });

        socket.emit('users_status', { users, timestamp: new Date().toISOString() });
      } catch (error) {
        console.error('Error handling get_users_status:', error);
        socket.emit('users_status', { users: [] });
      }
    });
    
  } catch (error) {
    console.error('Error setting up socket connection:', error);
  }
  
  socket.on('disconnect', async () => {
    console.log(`User ${socket.username} (${socket.userId}) disconnected:`, socket.id);
    try {
      const personalRoom = `user_${socket.userId}`;
      const stillConnectedElsewhere = (io.sockets.adapter.rooms.get(personalRoom)?.size || 0) > 0;
      if (stillConnectedElsewhere) {
        console.log(`ℹ️ ${socket.username} still has active socket(s), skipping offline broadcast`);
        return;
      }

      // If this user had an active/ringing call, notify the other party.
      // Without this, the remote user's call screen stays stuck forever
      // when the peer closes the browser or loses network.
      try {
        const activeCalls = await Call.find({
          $or: [
            { caller_id: socket.userId },
            { target_user_id: socket.userId }
          ],
          status: { $in: ['calling', 'connected'] }
        }).select('_id caller_id target_user_id status').lean();

        for (const call of activeCalls) {
          const otherUserId = String(call.caller_id) === String(socket.userId)
            ? String(call.target_user_id)
            : String(call.caller_id);

          const disconnectPayload = {
            id: String(call._id),
            callId: String(call._id),
            endedBy: socket.userId,
            reason: 'peer_disconnected',
            timestamp: new Date().toISOString()
          };

          io.to(`user_${otherUserId}`).emit('call_ended', disconnectPayload);
          io.to(getCallRoomId(socket.userId, otherUserId)).emit('call_ended', disconnectPayload);

          await Call.findByIdAndUpdate(call._id, {
            $set: {
              status: 'ended',
              ended_at: new Date(),
              updated_at: new Date()
            }
          }).catch(e => console.error('Failed to end call on disconnect:', e.message));
        }
      } catch (callCleanupErr) {
        console.error('Error cleaning up calls on disconnect:', callCleanupErr.message);
      }

      await userActivityMonitor.updateUserPresence(socket.userId, 'offline');
      socket.broadcast.emit('user_status', {
        userId: socket.userId,
        username: socket.username,
        status: 'offline',
        isOnline: false,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating user presence on disconnect:', error);
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

// ============================================
// RENDER FREE TIER KEEP-ALIVE (Self-Ping)
// Pings backend every 14 minutes to prevent 
// Render from spinning down the service
// Note: Frontend is static site (doesn't sleep)
// ============================================
const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes (Render sleeps after 15 min)
const BACKEND_URL = process.env.RENDER_EXTERNAL_URL || 'https://zerohook-api-f3ss.onrender.com';

const keepAlive = async () => {
  const timestamp = new Date().toISOString();
  
  // Ping backend health endpoint (self-ping)
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`, {
      method: 'GET',
      headers: { 'User-Agent': 'ZerohookKeepAlive/1.0' },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    const data = await response.json().catch(() => ({}));
    console.log(`🏓 [${timestamp}] Keep-alive ping: ${response.status === 200 ? '✅ OK' : '⚠️ ' + response.status} (DB: ${data.database || 'unknown'})`);
  } catch (error) {
    console.log(`🏓 [${timestamp}] Keep-alive ping failed: ${error.message}`);
  }
};

const startServer = () => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
    
    // Start keep-alive pings only in production (Render)
    if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
      console.log(`🏓 Keep-alive enabled: Self-ping every 14 minutes to ${BACKEND_URL}`);
      
      // Initial ping after 1 minute (let server fully start)
      setTimeout(keepAlive, 60 * 1000);
      
      // Then ping every 14 minutes
      setInterval(keepAlive, PING_INTERVAL);
    }
  });
};

if (require.main === module) {
  startServer();
}

// Graceful shutdown handler
function gracefulShutdown(signal) {
  console.log(`\n⚠️  Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('✅ HTTP server closed.');
    io.close(() => {
      console.log('✅ Socket.IO connections closed.');
      process.exit(0);
    });
  });
  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
module.exports.server = server;
module.exports.io = io;
module.exports.startServer = startServer;