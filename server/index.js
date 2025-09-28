const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
// Load environment variables based on NODE_ENV
const envPath = process.env.NODE_ENV === 'production' ? './env.production' : './env.local';
require('dotenv').config({ path: envPath });
console.log(`🔧 Loading environment from: ${envPath}`);
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

// Import services
const TrustEngine = require('./services/TrustEngine');
const FraudDetection = require('./services/FraudDetection');
const EscrowManager = require('./services/EscrowManager');
const PaystackManager = require('./services/PaystackManager');
const CryptoPaymentManager = require('./services/CryptoPaymentManager');
const CountryManager = require('./services/CountryManager');
const BitnobManager = require('./services/BitnobManager');
const UserConnectionManager = require('./services/UserConnectionManager');
const SystemHealthService = require('./services/SystemHealthService');
const { connectDB, connectRedis } = require('./config/database');

const app = express();
const server = createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Socket.io authentication middleware (moved to top)

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));

// Performance monitoring middleware
const performanceMonitoring = require('./middleware/performanceMonitoring');
app.use(performanceMonitoring);

// Rate limiting - More lenient for development
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 1 * 60 * 1000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // limit each IP to 1000 requests per minute
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and authentication endpoints
    return req.path === '/api/health' || 
           req.path === '/api/auth/login' || 
           req.path === '/api/auth/register' ||
           req.path === '/api/subscriptions/create';
  }
});

// Apply rate limiting to all routes EXCEPT auth and subscriptions
app.use('/api/', (req, res, next) => {
  if (req.path.startsWith('/api/auth/') || 
      req.path.startsWith('/api/subscriptions/') || 
      req.path === '/api/health') {
    return next(); // Skip rate limiting for these routes
  }
  return limiter(req, res, next);
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize services
const trustEngine = new TrustEngine();
const fraudDetection = new FraudDetection();
const escrowManager = new EscrowManager();
const paystackManager = new PaystackManager();
const cryptoPaymentManager = new CryptoPaymentManager();
const countryManager = new CountryManager();
const bitnobManager = new BitnobManager();
const userConnectionManager = new UserConnectionManager();

// Initialize health service
const systemHealth = new SystemHealthService();

// Initialize user monitoring services
const UserActivityMonitor = require('./services/UserActivityMonitor');
const PerformanceMetrics = require('./services/PerformanceMetrics');
const userActivityMonitor = new UserActivityMonitor();
const performanceMetrics = new PerformanceMetrics();

// Initialize all services
(async () => {
  try {
    const dbConnected = await connectDB();
    if (dbConnected) {
      console.log('✅ Database connected');
    } else {
      console.log('⚠️  Database connection failed, but server will continue running');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.log('⚠️  Server will continue running without database for frontend testing');
  }

  try {
    await connectRedis();
    console.log('✅ Redis connected');
  } catch (error) {
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
    console.log('✅ Escrow Manager initialized');
  } catch (error) {
    console.error('❌ Escrow Manager initialization failed:', error);
  }

  try {
    await paystackManager.initialize();
    console.log('✅ Paystack Manager initialized');
  } catch (error) {
    console.error('❌ Paystack Manager initialization failed:', error);
  }

  try {
    await cryptoPaymentManager.initialize();
    console.log('✅ Crypto Payment Manager initialized');
  } catch (error) {
    console.error('❌ Crypto Payment Manager initialization failed:', error);
  }

  try {
    await countryManager.initialize();
    console.log('✅ Country Manager initialized');
  } catch (error) {
    console.error('❌ Country Manager initialization failed:', error);
  }

  try {
    await bitnobManager.initialize();
    console.log('✅ Bitnob Manager initialized');
  } catch (error) {
    console.error('❌ Bitnob Manager initialization failed:', error);
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
  req.paystackManager = paystackManager;
  req.cryptoPaymentManager = cryptoPaymentManager;
  req.countryManager = countryManager;
  req.bitnobManager = bitnobManager;
  req.userActivityMonitor = userActivityMonitor;
  req.performanceMetrics = performanceMetrics;
  req.io = io;
  
  // Add database status to request for debugging
  req.dbAvailable = true; // This will be updated based on actual connection status
  
  next();
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.use('/api/uploads', uploadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/countries', countryRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/connections', userConnectionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/calls', callRoutes);
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
    
    // Join user's personal room
    socket.join(`user_${socket.userId}`);
    
    // Handle user activity
    socket.on('user_activity', async (data) => {
      await userActivityMonitor.logUserActivity(socket.userId, {
        ...data,
        ipAddress: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      });
    });
    
    // Handle typing indicators
    socket.on('typing_start', async (data) => {
      await userActivityMonitor.updateTypingStatus(socket.userId, true, data.conversationId);
      socket.to(`conversation_${data.conversationId}`).emit('user_typing', {
        userId: socket.userId,
        username: socket.username,
        conversationId: data.conversationId
      });
    });
    
    socket.on('typing_stop', async (data) => {
      await userActivityMonitor.updateTypingStatus(socket.userId, false, data.conversationId);
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
        
        // Join call room
        const callRoomId = `call_${data.targetUserId}_${socket.userId}`;
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
        
        // Join call room
        const callRoomId = `call_${socket.userId}_${data.targetUserId}`;
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
        
        // Leave call room
        const callRoomId = `call_${socket.userId}_${otherUserId}`;
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

    // ===== CHAT SYSTEM EVENTS =====
    
    // Handle joining conversation room
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation_${conversationId}`);
      console.log(`User ${socket.username} joined conversation ${conversationId}`);
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

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        console.log(`💬 Message from ${socket.username} to conversation ${data.conversationId}`);
        
        const messageData = {
          id: Date.now().toString(), // Simple ID generation
          conversationId: data.conversationId,
          senderId: socket.userId,
          senderUsername: socket.username,
          content: data.content,
          timestamp: new Date().toISOString(),
          type: data.type || 'text'
        };

        // Broadcast message to all users in the conversation
        io.to(`conversation_${data.conversationId}`).emit('new_message', messageData);
        
        // Log message activity
        await userActivityMonitor.logUserActivity(socket.userId, {
          actionType: 'send_message',
          actionData: { 
            conversationId: data.conversationId,
            messageId: messageData.id,
            contentLength: data.content.length
          },
          ipAddress: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent'],
          responseTimeMs: 0,
          success: true
        });
        
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

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
});