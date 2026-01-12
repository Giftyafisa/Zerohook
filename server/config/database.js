require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? './env.production' : './env.local' });
const mongoose = require('mongoose');
const Redis = require('redis');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://zerohook:11221122Ga@zerohook.cnyphi4.mongodb.net/zerohook?retryWrites=true&w=majority';

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
    await initializeCollections();
    
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
  last_active: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

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
  amount: { type: Number, required: true },
  escrow_address: String,
  status: { type: String, default: 'pending' },
  scheduled_time: Date,
  location_data: { type: mongoose.Schema.Types.Mixed, default: {} },
  verification_data: { type: mongoose.Schema.Types.Mixed, default: {} },
  dispute_data: { type: mongoose.Schema.Types.Mixed, default: {} },
  completion_proof: { type: mongoose.Schema.Types.Mixed, default: {} },
  completed_at: Date
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

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
  participant1_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participant2_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  last_message: String,
  last_message_time: Date
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const messageSchema = new mongoose.Schema({
  conversation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  message_type: { type: String, default: 'text' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  read_at: Date
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const fileUploadSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  file_name: { type: String, required: true },
  file_path: { type: String, required: true },
  file_size: { type: Number, required: true },
  mime_type: { type: String, required: true },
  upload_type: { type: String, required: true },
  status: { type: String, default: 'active' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

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
  paystack_reference: String,
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
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  status: { type: String, enum: ['online', 'away', 'busy', 'offline'], default: 'offline' },
  last_seen: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const userSessionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  session_token: { type: String, required: true, unique: true },
  socket_id: String,
  ip_address: String,
  user_agent: String,
  is_active: { type: Boolean, default: true },
  expires_at: { type: Date, required: true },
  last_activity: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const userActivityLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action_type: { type: String, required: true },
  action_data: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip_address: String,
  user_agent: String,
  response_time_ms: { type: Number, default: 0 },
  success: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

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

const initializeCollections = async () => {
  try {
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

// PostgreSQL-compatible query wrapper for backward compatibility
// This translates simple PostgreSQL queries to MongoDB operations
const query = async (text, params = []) => {
  if (!dbAvailable) {
    throw new Error('Database not available');
  }
  
  // Log the query for debugging during migration
  console.log('🔄 SQL Query (needs MongoDB migration):', text.substring(0, 100) + '...');
  
  // Return empty result for now - routes need to be updated to use Mongoose models
  return { rows: [], rowCount: 0 };
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
  ApiPerformanceLog
};
