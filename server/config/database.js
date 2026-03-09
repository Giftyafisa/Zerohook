require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? './env.production' : './env.local' });
const mongoose = require('mongoose');
const Redis = require('redis');

// MongoDB connection string
// Prefer env var; fallback to local MongoDB for dev stability
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/zerohook';

console.log('🔧 Database configuration loaded:');
console.log('   Environment:', process.env.NODE_ENV);
console.log('   Using MongoDB Atlas');
console.log('   Database:', 'zerohook');
console.log('   MONGODB_URI set:', !!process.env.MONGODB_URI);

// Redis connection (optional)
let redisClient = null;
try {
  redisClient = Redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    retry_strategy: (times) => Math.min(times * 50, 2000)
  });
} catch (error) {
  console.log('⚠️  Redis client creation failed, continuing without Redis');
}

// Track database availability
let dbAvailable = false;

const connectDB = async () => {
  console.log('🔄 Attempting MongoDB connection...');
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ MongoDB connected successfully');
    console.log('   Host:', mongoose.connection.host);
    console.log('   Database:', mongoose.connection.name);
    dbAvailable = true;
    
    // Initialize collections and indexes
    try {
      await initializeCollections();
    } catch (initErr) {
      // Index conflicts are non-fatal — the DB is still connected and usable
      console.warn('⚠️  Collection initialization had errors (non-fatal):', initErr.message);
    }
    
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Full error:', error);
    console.log('⚠️  Continuing without database for frontend testing...');
    dbAvailable = false;
    return false;
  }
};

const connectRedis = async () => {
  if (!redisClient) {
    console.log('⚠️  Redis is not configured - continuing without it');
    return false;
  }
  try {
    await redisClient.connect();
    console.log('✅ Redis connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    console.log('⚠️  Redis is optional - continuing without it');
    return false;
  }
};

// Define Mongoose Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  phone: String,
  verification_tier: { type: Number, default: 1 },
  verification_data: { type: mongoose.Schema.Types.Mixed, default: {} },
  reputation_score: { type: Number, default: 100.0 },
  trust_score: { type: Number, default: 0.0 },
  profile_data: { type: mongoose.Schema.Types.Mixed, default: {} },
  wallet_address: String,
  is_subscribed: { type: Boolean, default: false },
  subscription_tier: { type: String, default: 'free' },
  subscription_expires_at: Date,
  status: { type: String, default: 'active' },
  last_active: { type: Date, default: Date.now },
  // Dispute tracking and ban system
  dispute_strikes: { type: Number, default: 0 }, // 3 strikes = ban
  dispute_warnings: [{
    warning_number: Number,
    reason: String,
    escrow_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
    issued_at: { type: Date, default: Date.now }
  }],
  // Admin & role flags
  is_admin: { type: Boolean, default: false },
  role: { type: String, default: 'user' }, // 'user' | 'admin'
  is_banned: { type: Boolean, default: false },
  ban_data: {
    banned_at: Date,
    ban_reason: String,
    ban_type: { type: String, enum: ['dispute_fraud', 'manual', 'other'] },
    related_disputes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }]
  },
  unban_requests: [{
    requested_at: { type: Date, default: Date.now },
    reason: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewed_at: Date,
    admin_notes: String
  }]
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// H2: Geospatial index for location-based queries (Uber-style proximity search)
// Uses GeoJSON Point format: profile_data.location.geoPoint = { type: 'Point', coordinates: [lng, lat] }
userSchema.index({ 'profile_data.location.geoPoint': '2dsphere' }, { sparse: true });

// L3: Compound index for account type filtering + activity sorting (recommendation engine)
userSchema.index({ 'profile_data.accountType': 1, last_active: -1 }, { sparse: true });

// Additional useful indexes for the recommendation engine
userSchema.index({ 'profile_data.country': 1, 'profile_data.accountType': 1 }, { sparse: true });
userSchema.index({ is_subscribed: 1, subscription_expires_at: 1 });
userSchema.index({ status: 1, last_active: -1 });

const serviceCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  display_name: { type: String, required: true },
  description: String,
  base_price: { type: Number, default: 0 },
  duration_options: { type: [Number], default: [] },
  verification_required: { type: Number, default: 1 }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const serviceSchema = new mongoose.Schema({
  provider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCategory' },
  title: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  duration_minutes: { type: Number, default: 60 },
  location_type: { type: String, default: 'flexible' },
  location_data: { type: mongoose.Schema.Types.Mixed, default: {} },
  availability: { type: mongoose.Schema.Types.Mixed, default: {} },
  requirements: { type: mongoose.Schema.Types.Mixed, default: {} },
  media_urls: { type: [String], default: [] },
  status: { type: String, default: 'active' },
  views: { type: Number, default: 0 },
  bookings: { type: Number, default: 0 },
  rating: { type: Number, default: 0.0 }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const transactionSchema = new mongoose.Schema({
  service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  provider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For wallet transactions
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  country_code: String,
  payment_method: { type: String, default: 'crypto' },
  reference: String,
  escrow_address: String,
  status: { type: String, default: 'pending' },
  type: { type: String, default: 'service' }, // 'service', 'deposit', 'withdrawal', 'escrow_hold', 'escrow_release'
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  scheduled_time: Date,
  location_data: { type: mongoose.Schema.Types.Mixed, default: {} },
  verification_data: { type: mongoose.Schema.Types.Mixed, default: {} },
  dispute_data: { type: mongoose.Schema.Types.Mixed, default: {} },
  completion_proof: { type: mongoose.Schema.Types.Mixed, default: {} },
  completed_at: Date,
  // PIN Verification System (Uber-style)
  completion_pin: { type: String }, // 6-digit PIN only visible to client
  pin_attempts: { type: Number, default: 0 }, // Brute-force protection counter
  pin_entered_at: Date, // When provider entered the PIN
  pin_entered_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  confirmed_at: Date, // When payment was confirmed/completed
  // Dual Confirmation System
  client_confirmed: { type: Boolean, default: false },
  client_confirmed_at: Date,
  provider_confirmed: { type: Boolean, default: false },
  provider_confirmed_at: Date,
  // Auto-release tracking
  auto_release_at: Date, // When funds will auto-release if no dispute
  confirmation_deadline: Date, // Client must confirm/dispute before this
  // Provider Service Completion Claim (for when client refuses to share PIN)
  provider_claimed_complete: { type: Boolean, default: false },
  provider_claim_data: {
    claimed_at: Date,
    evidence_description: String,
    evidence_files: [{
      file_url: String,
      file_type: String,
      uploaded_at: { type: Date, default: Date.now }
    }],
    client_notified_at: Date,
    client_response_deadline: Date // Client has 24h to share PIN or dispute
  },
  // Evidence for disputes
  evidence: [{
    uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    file_url: String,
    file_type: String,
    description: String,
    uploaded_at: { type: Date, default: Date.now }
  }]
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Index for efficient wallet queries
transactionSchema.index({ user_id: 1, type: 1, status: 1 });
transactionSchema.index({ client_id: 1, status: 1 });
transactionSchema.index({ provider_id: 1, status: 1 });
transactionSchema.index({ reference: 1 }, { unique: true, sparse: true });

const trustEventSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  event_type: { type: String, required: true },
  event_data: { type: mongoose.Schema.Types.Mixed, required: true },
  trust_delta: { type: Number, default: 0 },
  reputation_delta: { type: Number, default: 0 },
  transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const reviewSchema = new mongoose.Schema({
  transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  reviewer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rating: { type: Number, min: 1, max: 5 },
  comment: String,
  anonymous: { type: Boolean, default: false }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const fraudLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  fraud_type: { type: String, required: true },
  confidence_score: { type: Number, required: true },
  evidence: { type: mongoose.Schema.Types.Mixed, required: true },
  action_taken: String
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const conversationSchema = new mongoose.Schema({
  participant1Id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participant2Id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participant1Hidden: { type: Boolean, default: false },
  participant2Hidden: { type: Boolean, default: false },
  participant1HiddenAt: { type: Date, default: null },
  participant2HiddenAt: { type: Date, default: null },
  lastMessage: String,
  lastMessageType: { type: String, default: 'text' },
  lastMessageTime: Date,
  status: { type: String, default: 'active' }
}, { timestamps: true });

// Compound index prevents duplicate conversations between same pair of users
conversationSchema.index({ participant1Id: 1, participant2Id: 1 }, { unique: true });
conversationSchema.index({ participant2Id: 1, participant1Id: 1 });
conversationSchema.index({ participant1Id: 1, participant1Hidden: 1, lastMessageTime: -1 });
conversationSchema.index({ participant2Id: 1, participant2Hidden: 1, lastMessageTime: -1 });

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  messageType: { type: String, default: 'text' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  readAt: Date
}, { timestamps: true });

// Compound indexes for chat performance
// 1. Fast message listing per conversation (sorted by time)
messageSchema.index({ conversationId: 1, createdAt: 1 });
// 2. Fast unread count + mark-as-read bulk update
messageSchema.index({ conversationId: 1, senderId: 1, readAt: 1 });

const fileUploadSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String }, // For content posts - cache username for feed display
  service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  file_name: { type: String, required: true },
  file_path: { type: String, required: true },
  file_size: { type: Number, required: true },
  mime_type: { type: String, required: true },
  upload_type: { type: String, required: true },
  status: { type: String, default: 'active' },
  // NEW: Cloudinary/storage tracking fields
  storage_type: { type: String, enum: ['local', 'cloudinary'], default: 'local' },
  cloudinary_public_id: { type: String },
  // NEW: Content post metadata (for TikTok-style posts)
  metadata: {
    caption: { type: String },
    category: { type: String, default: 'showcase' },
    price: { type: Number, default: 0 },
    location: { type: String },
    contentType: { type: String, enum: ['image', 'video'], default: 'image' },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Indexes for efficient content feed queries
fileUploadSchema.index({ upload_type: 1, status: 1, created_at: -1 });
fileUploadSchema.index({ 'metadata.category': 1 });
fileUploadSchema.index({ user_id: 1, upload_type: 1 });

const escrowTransactionSchema = new mongoose.Schema({
  transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'pending' },
  escrow_address: String
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const refundRequestSchema = new mongoose.Schema({
  transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  status: { type: String, default: 'pending' },
  admin_notes: String
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const blockedUserSchema = new mongoose.Schema({
  blocker_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  blocked_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: String
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
blockedUserSchema.index({ blocker_id: 1, blocked_id: 1 }, { unique: true });

const verificationRequestSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requested_tier: { type: Number, required: true },
  document_type: String,
  document_number: String,
  document_images: { type: mongoose.Schema.Types.Mixed },
  reason: String,
  status: { type: String, default: 'pending' },
  admin_notes: String
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const subscriptionPlanSchema = new mongoose.Schema({
  plan_name: { type: String, required: true, unique: true },
  description: String,
  price: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  features: { type: mongoose.Schema.Types.Mixed },
  is_active: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const subscriptionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  country_code: String,
  crypto_reference: String,
  status: { type: String, default: 'pending' },
  activated_at: Date,
  expires_at: Date
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const callSchema = new mongoose.Schema({
  caller_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  target_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['audio', 'video'], required: true },
  status: { type: String, enum: ['calling', 'connected', 'rejected', 'ended', 'missed'], default: 'calling' },
  connected_at: Date,
  ended_at: Date,
  duration: Number,
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const userPresenceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  status: { type: String, enum: ['online', 'away', 'busy', 'offline'], default: 'offline' },
  lastSeen: { type: Date, default: Date.now },
  isTyping: { type: Boolean, default: false },
  currentPage: { type: String }
}, { timestamps: true });

const userSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionToken: { type: String }, // No index on this field - compound index below handles uniqueness
  socketId: { type: String },
  ipAddress: String,
  userAgent: String,
  isActive: { type: Boolean, default: true },
  expiresAt: { type: Date },
  lastActivity: { type: Date, default: Date.now }
}, { timestamps: true });

// Create compound index for userId + socketId to allow upsert operations
userSessionSchema.index({ userId: 1, socketId: 1 }, { unique: true, sparse: true });

const userActivityLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actionType: { type: String, required: true },
  actionData: { type: mongoose.Schema.Types.Mixed, default: {} },
  ipAddress: String,
  userAgent: String,
  responseTimeMs: { type: Number, default: 0 },
  success: { type: Boolean, default: true },
  errorMessage: String
}, { timestamps: true });

const apiPerformanceLogSchema = new mongoose.Schema({
  endpoint: { type: String, required: true },
  method: { type: String, required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  response_time_ms: { type: Number, required: true },
  status_code: { type: Number, required: true },
  request_size_bytes: { type: Number, default: 0 },
  response_size_bytes: { type: Number, default: 0 },
  ip_address: String,
  user_agent: String,
  error_message: String
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Sugar Access Payment Schema
const sugarAccessPaymentSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accessType: { type: String, enum: ['sugar_daddy', 'sugar_mommy', 'both'], required: true },
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
  paymentReference: String,
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  accessStartsAt: { type: Date },
  accessExpiresAt: { type: Date },
  paymentGateway: { type: String, default: 'crypto' }
}, { timestamps: true });

sugarAccessPaymentSchema.index({ providerId: 1, accessExpiresAt: -1 });

// User Engagement Metrics Schema
const userEngagementMetricSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  lastEngagementDate: { type: Date, default: Date.now },
  totalLogins: { type: Number, default: 0 },
  totalMessagesSet: { type: Number, default: 0 },
  totalProfileViews: { type: Number, default: 0 }
}, { timestamps: true });

// User Engagement Events Schema
const userEngagementEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventType: { type: String, required: true },
  eventMetadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

userEngagementEventSchema.index({ userId: 1, createdAt: -1 });

// Adult Service Schema
const adultServiceSchema = new mongoose.Schema({
  provider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, required: true },
  subcategory: String,
  title: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  duration_minutes: { type: Number, default: 60 },
  location_type: { type: String, default: 'flexible' },
  location_data: { type: mongoose.Schema.Types.Mixed, default: {} },
  availability: { type: mongoose.Schema.Types.Mixed, default: {} },
  requirements: { type: mongoose.Schema.Types.Mixed, default: {} },
  images: { type: [String], default: [] },
  is_active: { type: Boolean, default: true },
  is_verified: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  bookings: { type: Number, default: 0 }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

adultServiceSchema.index({ category: 1, is_active: 1 });
adultServiceSchema.index({ provider_id: 1 });
adultServiceSchema.index({ price: 1 });

// User Privacy Settings Schema
const userPrivacySettingsSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  privacy_level: { type: String, enum: ['minimal', 'standard', 'enhanced', 'premium'], default: 'minimal' },
  profile_visibility: { type: String, enum: ['public', 'private', 'connections'], default: 'public' },
  data_sharing_preferences: { type: String, enum: ['minimal', 'standard', 'enhanced'], default: 'minimal' },
  location_sharing: { type: Boolean, default: false },
  photo_sharing: { type: Boolean, default: false },
  contact_sharing: { type: Boolean, default: false }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// user_id already has unique: true which creates an index automatically

// Privacy Consent Schema
const privacyConsentSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  consent_type: { type: String, required: true },
  granted: { type: Boolean, default: false },
  granted_at: { type: Date },
  revoked_at: { type: Date }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

privacyConsentSchema.index({ user_id: 1, consent_type: 1 }, { unique: true });

// ========================================
// ContentPost Schema - TikTok-style posts
// ========================================
const contentPostSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  media_url: { type: String, required: true },
  media_type: { type: String, enum: ['image', 'video'], required: true },
  thumbnail_url: String,
  caption: { type: String, default: '', maxlength: 2000 },
  category: { type: String, default: 'showcase', enum: ['showcase', 'promo', 'lifestyle', 'behind-scenes', 'announcement', 'long-term', 'short-term', 'oral-services', 'special-services'] },
  tags: { type: [String], default: [] },
  price: { type: Number, default: 0 },
  location: { type: String, default: '' },
  // Engagement
  likes_count: { type: Number, default: 0 },
  liked_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments_count: { type: Number, default: 0 },
  shares_count: { type: Number, default: 0 },
  views_count: { type: Number, default: 0 },
  bookmarks_count: { type: Number, default: 0 },
  bookmarked_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Linked service (optional - link post to a service listing)
  linked_service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AdultService' },
  // Moderation
  status: { type: String, default: 'active', enum: ['active', 'pending_review', 'flagged', 'removed'] },
  reported_count: { type: Number, default: 0 },
  reported_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Storage
  storage_type: { type: String, default: 'local', enum: ['local', 'cloudinary'] },
  cloudinary_public_id: String,
  file_size: Number,
  // Engagement score for algorithm
  engagement_score: { type: Number, default: 0 },
  is_pinned: { type: Boolean, default: false }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

contentPostSchema.index({ user_id: 1, created_at: -1 });
contentPostSchema.index({ category: 1, status: 1, created_at: -1 });
contentPostSchema.index({ status: 1, engagement_score: -1 });
contentPostSchema.index({ status: 1, created_at: -1 });
contentPostSchema.index({ tags: 1 });

// ========================================
// Comment Schema
// ========================================
const commentSchema = new mongoose.Schema({
  post_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentPost', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  text: { type: String, required: true, maxlength: 1000 },
  parent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  likes_count: { type: Number, default: 0 },
  liked_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, default: 'active', enum: ['active', 'flagged', 'removed'] }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

commentSchema.index({ post_id: 1, created_at: -1 });
commentSchema.index({ user_id: 1 });
commentSchema.index({ parent_id: 1 });

// ========================================
// Follow Schema
// ========================================
const followSchema = new mongoose.Schema({
  follower_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  following_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, default: 'active', enum: ['active', 'blocked'] }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

followSchema.index({ follower_id: 1, following_id: 1 }, { unique: true });
followSchema.index({ following_id: 1 });
followSchema.index({ follower_id: 1 });

// ========================================
// Bookmark Schema
// ========================================
const bookmarkSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  post_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentPost', required: true },
  collection_name: { type: String, default: 'default' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

bookmarkSchema.index({ user_id: 1, post_id: 1 }, { unique: true });
bookmarkSchema.index({ user_id: 1, created_at: -1 });

// Create Models
const User = mongoose.model('User', userSchema);
const ServiceCategory = mongoose.model('ServiceCategory', serviceCategorySchema);
const Service = mongoose.model('Service', serviceSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const TrustEvent = mongoose.model('TrustEvent', trustEventSchema);
const Review = mongoose.model('Review', reviewSchema);
const FraudLog = mongoose.model('FraudLog', fraudLogSchema);
const Conversation = mongoose.model('Conversation', conversationSchema);
const Message = mongoose.model('Message', messageSchema);
const FileUpload = mongoose.model('FileUpload', fileUploadSchema);
const EscrowTransaction = mongoose.model('EscrowTransaction', escrowTransactionSchema);
const RefundRequest = mongoose.model('RefundRequest', refundRequestSchema);
const BlockedUser = mongoose.model('BlockedUser', blockedUserSchema);
const VerificationRequest = mongoose.model('VerificationRequest', verificationRequestSchema);
const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
const Subscription = mongoose.model('Subscription', subscriptionSchema);
const Call = mongoose.model('Call', callSchema);
const UserPresence = mongoose.model('UserPresence', userPresenceSchema);
const UserSession = mongoose.model('UserSession', userSessionSchema);
const UserActivityLog = mongoose.model('UserActivityLog', userActivityLogSchema);
const ApiPerformanceLog = mongoose.model('ApiPerformanceLog', apiPerformanceLogSchema);
const SugarAccessPayment = mongoose.model('SugarAccessPayment', sugarAccessPaymentSchema);
const UserEngagementMetric = mongoose.model('UserEngagementMetric', userEngagementMetricSchema);
const UserEngagementEvent = mongoose.model('UserEngagementEvent', userEngagementEventSchema);
const AdultService = mongoose.model('AdultService', adultServiceSchema);
const UserPrivacySettings = mongoose.model('UserPrivacySettings', userPrivacySettingsSchema);
const PrivacyConsent = mongoose.model('PrivacyConsent', privacyConsentSchema);
const ContentPost = mongoose.model('ContentPost', contentPostSchema);
const Comment = mongoose.model('Comment', commentSchema);
const Follow = mongoose.model('Follow', followSchema);
const Bookmark = mongoose.model('Bookmark', bookmarkSchema);

// Notification Schema
const notificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, default: 'system' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  read: { type: Boolean, default: false }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const Notification = mongoose.model('Notification', notificationSchema);

// Milestone Request Schema
const milestoneRequestSchema = new mongoose.Schema({
  sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  description: { type: String, default: '' },
  request_type: { type: String, enum: ['provider_request', 'client_request'], default: 'provider_request' },
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'paid'], default: 'pending' },
  escrow_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const MilestoneRequest = mongoose.model('MilestoneRequest', milestoneRequestSchema);

// User Connection Schema
const userConnectionSchema = new mongoose.Schema({
  from_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  connection_type: { type: String, default: 'contact_request' },
  message: { type: String, default: '' },
  status: { type: String, default: 'pending' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const UserConnection = mongoose.model('UserConnection', userConnectionSchema);

// Crypto payment invoice schema - persists pending/expired invoices across server restarts
const cryptoInvoiceSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  address: { type: String, required: true },
  cryptoAmount: { type: Number, required: true },
  cryptoSymbol: { type: String, required: true },
  fiatAmount: Number,
  fiatCurrency: String,
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  derivationIndex: Number,
  addressMethod: String,
  status: { type: String, default: 'pending', index: true }, // pending, confirmed, expired
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });
cryptoInvoiceSchema.index({ status: 1, expiresAt: 1 });

const CryptoInvoice = mongoose.model('CryptoInvoice', cryptoInvoiceSchema);

// System counter schema - for persistent derivation index etc.
const systemCounterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // counter name, e.g. 'crypto_deriv_index'
  value: { type: Number, default: 0 }
});

const SystemCounter = mongoose.model('SystemCounter', systemCounterSchema);

// Refresh Token Schema - for token rotation & revocation
const refreshTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  token: { type: String, required: true, unique: true },
  family: { type: String, required: true, index: true }, // Token family for rotation detection
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }, // TTL auto-delete
  revoked: { type: Boolean, default: false },
  replacedBy: { type: String, default: null }, // Points to the next token in the rotation chain
  userAgent: { type: String },
  ipAddress: { type: String }
}, { timestamps: true });

refreshTokenSchema.index({ userId: 1, family: 1 });

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

const initializeCollections = async () => {
  try {
    // Drop stale conflicting index before creating new ones
    try {
      const msgCollection = mongoose.connection.collection('messages');
      const existingIndexes = await msgCollection.indexes();
      const staleIndex = existingIndexes.find(i => i.name === 'idx_mark_read');
      if (staleIndex) {
        await msgCollection.dropIndex('idx_mark_read');
        console.log('🗑️ Dropped stale index: idx_mark_read');
      }
    } catch (dropErr) {
      // Non-fatal — index may not exist
    }

    // Create indexes
    await User.createIndexes();
    await Service.createIndexes();
    await Transaction.createIndexes();
    await Conversation.createIndexes();
    await Message.createIndexes();
    
    console.log('✅ MongoDB indexes created');
    
    // Insert default service categories if they don't exist
    const existingCategories = await ServiceCategory.countDocuments();
    if (existingCategories === 0) {
      await ServiceCategory.insertMany([
        { name: 'dgy', display_name: 'Dgy Services', description: 'Premium personal services', base_price: 100.00, duration_options: [30, 60, 120, 240], verification_required: 2 },
        { name: 'romans', display_name: 'Romans Experience', description: 'Authentic cultural experiences', base_price: 150.00, duration_options: [60, 120, 180], verification_required: 2 },
        { name: 'ridin', display_name: 'Ridin Adventures', description: 'Exciting adventure services', base_price: 80.00, duration_options: [45, 90, 180], verification_required: 1 },
        { name: 'bb_suk', display_name: 'Bb Suk Special', description: 'Exclusive premium offerings', base_price: 200.00, duration_options: [90, 180, 360], verification_required: 3 }
      ]);
      console.log('✅ Default service categories created');
    }
    
    // Insert default subscription plan if it doesn't exist
    const existingPlans = await SubscriptionPlan.countDocuments();
    if (existingPlans === 0) {
      await SubscriptionPlan.create({
        plan_name: 'Basic Access',
        description: 'Full access to the Zerohook platform',
        price: 20.00,
        currency: 'USD',
        features: ['Full platform access', 'Browse services', 'Create services', 'Secure messaging', 'Trust system', '24/7 support']
      });
      console.log('✅ Default subscription plan created');
    }
    
    console.log('✅ MongoDB collections initialized successfully');
    
  } catch (error) {
    console.error('❌ MongoDB collection initialization failed:', error.message);
    throw error;
  }
};

// PostgreSQL-compatible query wrapper — REMOVED after MongoDB migration.
// Any caller using this is a bug. Keeping the export symbol so require()
// destructuring doesn't crash, but the function immediately throws.
const query = () => {
  const err = new Error(
    'FATAL: Legacy SQL query() called after MongoDB migration. ' +
    'Migrate the calling code to use Mongoose models (User, Service, etc.).'
  );
  err.code = 'LEGACY_SQL_REMOVED';
  throw err;
};

const getClient = async () => {
  if (!dbAvailable) {
    throw new Error('Database not available');
  }
  return mongoose.connection;
};

// Check if database is available
const isDatabaseAvailable = () => dbAvailable;

// Export everything needed
module.exports = {
  mongoose,
  redisClient,
  connectDB,
  connectRedis,
  query,
  getClient,
  isDatabaseAvailable,
  // Export all models
  User,
  ServiceCategory,
  Service,
  Transaction,
  TrustEvent,
  Review,
  FraudLog,
  Conversation,
  Message,
  FileUpload,
  EscrowTransaction,
  RefundRequest,
  BlockedUser,
  VerificationRequest,
  SubscriptionPlan,
  Subscription,
  Call,
  UserPresence,
  UserSession,
  UserActivityLog,
  ApiPerformanceLog,
  SugarAccessPayment,
  UserEngagementMetric,
  UserEngagementEvent,
  AdultService,
  UserPrivacySettings,
  PrivacyConsent,
  CryptoInvoice,
  SystemCounter,
  RefreshToken,
  Notification,
  MilestoneRequest,
  UserConnection,
  ContentPost,
  Comment,
  Follow,
  Bookmark
};
