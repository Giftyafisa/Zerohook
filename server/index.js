const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
// Load environment variables based on NODE_ENV
const envPath = process.env.NODE_ENV === 'production' ? './env.production' : './env.local';
require('dotenv').config({ path: envPath });
console.log(`🔧 Loading environment from: ${envPath}`);
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
  console.error('❌ JWT_SECRET is missing or too weak. Set a strong secret (min 32 chars).');
  process.exit(1);
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
const { connectDB, connectRedis } = require('./config/database');

const app = express();
const server = createServer(app);

// Track critical service health
const serviceStatus = {
  db: false,
  redis: false
};

// Socket.io setup with CORS for web and mobile
const io = new Server(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL,
      'https://zerohook.onrender.com',
      'https://zerohook-web.onrender.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:19006',
      'http://localhost:8081'
    ].filter(Boolean),
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

// CORS configuration - supports web frontend and mobile apps
const allowedOrigins = [
  process.env.CLIENT_URL,
  'https://zerohook.onrender.com',
  'https://zerohook-web.onrender.com',
  'http://localhost:3000',
  'http://localhost:19006', // Expo web
  'http://localhost:8081',  // Metro bundler
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In development, allow localhost on any port
    const isDev = (process.env.NODE_ENV || 'development') === 'development';
    if (isDev && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

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
  message: { error: 'Too many requests from this IP, please try again later.', retryAfter: '5 minutes' },
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

// Initialize all services
(async () => {
  try {
    const dbConnected = await connectDB();
    serviceStatus.db = Boolean(dbConnected);
    if (dbConnected) {
      console.log('✅ Database connected');
    } else {
      console.log('⚠️  Database connection failed, but server will continue running');
    }
  } catch (error) {
    serviceStatus.db = false;
    console.error('❌ Database connection failed:', error);
    console.log('⚠️  Server will continue running without database for frontend testing');
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
})();

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
  // Set CORS headers for uploaded files
  res.setHeader('Access-Control-Allow-Origin', '*');
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
    
    // Handle heartbeat/ping
    socket.on('heartbeat', async () => {
      await userActivityMonitor.logUserActivity(socket.userId, {
        actionType: 'heartbeat',
        actionData: { socketId: socket.id },
        ipAddress: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
        responseTimeMs: 0,
        success: true
      });
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
        console.log(`📞 Call request from ${socket.username} to user ${data.targetUserId}`);
        
        // Emit incoming call to target user
        socket.to(`user_${data.targetUserId}`).emit('incoming_call', {
          id: Date.now().toString(),
          callerId: socket.userId,
          callerName: socket.username,
          type: data.type, // 'audio' or 'video'
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
        console.log(`✅ Call accepted by ${socket.username}`);
        
        // Emit call accepted to caller
        socket.to(`user_${data.targetUserId}`).emit('call_accepted', {
          callId: data.callId,
          targetUserId: socket.userId,
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
        console.log(`❌ Call rejected by ${socket.username}`);
        
        // Emit call rejected to caller
        socket.to(`user_${data.targetUserId}`).emit('call_rejected', {
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
        console.log(`📞 Call ended by ${socket.username}`);
        
        // Emit call ended to other participant
        const otherUserId = data.targetUserId === socket.userId ? data.callerId : data.targetUserId;
        socket.to(`user_${otherUserId}`).emit('call_ended', {
          callId: data.callId,
          endedBy: socket.userId,
          timestamp: new Date().toISOString()
        });
        
        // Leave call room (normalized)
        const callRoomId = getCallRoomId(socket.userId, otherUserId);
        socket.leave(callRoomId);
        
      } catch (error) {
        console.error('Error handling call end:', error);
      }
    });

    // Handle call cancellation
    socket.on('cancel_call', async (data) => {
      try {
        console.log(`🚫 Call cancelled by ${socket.username}`);
        
        // Emit call cancelled to target user
        socket.to(`user_${data.targetUserId}`).emit('call_cancelled', {
          callerId: socket.userId,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('Error handling call cancellation:', error);
      }
    });

    // ===== WebRTC SIGNALING EVENTS (for video/audio calls) =====
    
    // Handle WebRTC offer from caller
    socket.on('webrtc_offer', async (data) => {
      try {
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
    socket.on('join_conversation', async (conversationId) => {
      try {
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
    socket.on('mark_read', (data) => {
      socket.to(`conversation_${data.conversationId}`).emit('message_read', {
        userId: socket.userId,
        username: socket.username,
        conversationId: data.conversationId,
        messageId: data.messageId,
        timestamp: new Date().toISOString()
      });
    });

    // Handle sending messages (transactional + moderation)
    socket.on('send_message', async (data) => {
      const { conversationId, content, type = 'text', metadata = {} } = data || {};
      try {
        console.log(`💬 Message from ${socket.username} to conversation ${conversationId}`);

        // Basic validation
        if (!conversationId || !content) {
          console.warn(`Invalid message payload from ${socket.userId}`);
          return socket.emit('message_error', { error: 'Invalid message payload' });
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
            const mod = await fraudDetection.analyzeMessageRisk({ senderId: socket.userId, conversationId, content, messageType: type, metadata });
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
          messageRow = await conversationService.insertMessageTx({ conversationId, senderId: socket.userId, content, messageType: type, metadata });
        } catch (dbErr) {
          console.error('Database error inserting message:', dbErr);
          return socket.emit('message_error', { error: 'Database error, please try again' });
        }

        const messageData = {
          id: messageRow.id,
          conversationId,
          senderId: socket.userId,
          senderUsername: socket.username,
          content,
          timestamp: messageRow.created_at,
          type
        };

        // Broadcast message after commit
        io.to(`conversation_${conversationId}`).emit('new_message', messageData);

        // Log message activity (don't block on error)
        try {
          await userActivityMonitor.logUserActivity(socket.userId, {
            actionType: 'send_message',
            actionData: { conversationId, messageId: messageRow.id, contentLength: content.length },
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

    // Handle user status requests
    socket.on('get_user_status', async (data) => {
      try {
        console.log(`📊 User ${socket.username} requesting status for user ${data.userId}`);
        
        // Get user status from database
        const userStatus = await userActivityMonitor.getUserStatus(data.userId);
        
        // Emit status back to requesting user
        socket.emit('user_status', {
          userId: data.userId,
          isOnline: userStatus?.isOnline || false,
          lastSeen: userStatus?.lastSeen || null,
          status: userStatus?.status || 'offline',
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
    
  } catch (error) {
    console.error('Error setting up socket connection:', error);
  }
  
  socket.on('disconnect', async () => {
    console.log(`User ${socket.username} (${socket.userId}) disconnected:`, socket.id);
    try {
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
const BACKEND_URL = process.env.RENDER_EXTERNAL_URL || 'https://zerohook-api.onrender.com';

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