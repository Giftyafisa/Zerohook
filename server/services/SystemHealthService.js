const mongoose = require('mongoose');
const {
  User,
  Service,
  Conversation,
  Message,
  redisClient,
  connectRedis,
  isDatabaseAvailable,
  isRedisConfigured,
  isRedisAvailable,
  getRedisStatus
} = require('../config/database');

class SystemHealthService {
  constructor() {
    this.healthStatus = {
      database: false,
      redis: false,
      redisOptional: true,
      fileSystem: false,
      services: {},
      overall: false,
      critical: false,
      warnings: []
    };

    this.redisReconnectCooldownMs = parseInt(process.env.REDIS_HEALTH_RETRY_MS, 10) || 60000;
    this.lastRedisReconnectAttemptAt = 0;
  }

  async checkDatabaseHealth() {
    try {
      // Check MongoDB connection state
      const isConnected = isDatabaseAvailable() && mongoose.connection.readyState === 1;
      this.healthStatus.database = isConnected;
      return isConnected;
    } catch (error) {
      console.error('Database health check failed:', error.message);
      this.healthStatus.database = false;
      return false;
    }
  }

  async checkFileSystemHealth() {
    try {
      const fs = require('fs');
      const path = require('path');
      const uploadsDir = path.join(__dirname, '../uploads');
      
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Test write permission
      const testFile = path.join(uploadsDir, '.health-test');
      fs.writeFileSync(testFile, 'health check');
      fs.unlinkSync(testFile);
      
      this.healthStatus.fileSystem = true;
      return true;
    } catch (error) {
      console.error('File system health check failed:', error.message);
      this.healthStatus.fileSystem = false;
      return false;
    }
  }

  async checkRedisHealth() {
    // Redis is optional in this platform; if not configured, don't mark health as failed.
    if (!isRedisConfigured()) {
      this.healthStatus.redis = false;
      this.healthStatus.redisDetails = {
        configured: false,
        connected: false,
        status: 'disabled'
      };
      return false;
    }

    try {
      if (!isRedisAvailable()) {
        const now = Date.now();
        const canAttemptReconnect = now - this.lastRedisReconnectAttemptAt >= this.redisReconnectCooldownMs;
        if (canAttemptReconnect) {
          this.lastRedisReconnectAttemptAt = now;
          await connectRedis();
        }
      }

      if (redisClient?.isReady) {
        await redisClient.ping();
      }

      const connected = isRedisAvailable();
      const redisStatus = getRedisStatus();
      this.healthStatus.redisDetails = {
        ...redisStatus,
        connected,
        status: connected ? 'connected' : 'unavailable'
      };

      this.healthStatus.redis = connected;
      return connected;
    } catch (error) {
      const redisStatus = getRedisStatus();
      this.healthStatus.redisDetails = {
        ...redisStatus,
        connected: false,
        status: 'unavailable',
        lastError: error.message
      };
      this.healthStatus.redis = false;
      return false;
    }
  }

  async checkServiceHealth() {
    try {
      // Check if MongoDB collections exist by counting documents
      const collections = ['users', 'services', 'conversations', 'messages'];
      
      const collectionChecks = await Promise.all(
        collections.map(async (collection) => {
          try {
            const count = await mongoose.connection.db.collection(collection).countDocuments({});
            return { collection, exists: true, count };
          } catch (error) {
            return { collection, exists: false, error: error.message };
          }
        })
      );
      
      const missingCollections = collectionChecks.filter(check => !check.exists);
      this.healthStatus.services.collections = {
        total: collections.length,
        existing: collections.length - missingCollections.length,
        missing: missingCollections.map(c => c.collection)
      };
      
      // Check data counts using Mongoose models
      try {
        const userCount = await User.countDocuments();
        const serviceCount = await Service.countDocuments();
        const conversationCount = await Conversation.countDocuments();
        
        this.healthStatus.services.data = {
          users: userCount,
          services: serviceCount,
          conversations: conversationCount
        };
      } catch (error) {
        this.healthStatus.services.data = { error: error.message };
      }
      
      return missingCollections.length === 0;
    } catch (error) {
      console.error('Service health check failed:', error.message);
      this.healthStatus.services.error = error.message;
      return false;
    }
  }

  async performFullHealthCheck() {
    console.log('🏥 Performing system health check...');

    const [databaseHealthy, fileSystemHealthy, redisHealthy, servicesHealthy] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkFileSystemHealth(),
      this.checkRedisHealth(),
      this.checkServiceHealth()
    ]);

    const criticalChecksHealthy = [databaseHealthy, fileSystemHealthy, servicesHealthy].every(Boolean);

    const warnings = [];
    if (isRedisConfigured() && !redisHealthy) {
      warnings.push('Redis unavailable; cache-dependent optimizations are disabled.');
    }

    this.healthStatus.critical = criticalChecksHealthy;
    this.healthStatus.overall = criticalChecksHealthy;
    this.healthStatus.warnings = warnings;
    this.healthStatus.lastChecked = new Date().toISOString();

    const statusLabel = !criticalChecksHealthy
      ? '❌ Issues detected'
      : (warnings.length > 0 ? '⚠️ Healthy (non-critical warnings)' : '✅ Healthy');

    console.log(`🏥 Health check completed: ${statusLabel}`);
    
    return this.healthStatus;
  }

  getHealthStatus() {
    return this.healthStatus;
  }

  isHealthy() {
    return this.healthStatus.overall === true;
  }

  async getDetailedStatus() {
    await this.performFullHealthCheck();

    const status = this.healthStatus.critical
      ? (this.healthStatus.warnings.length > 0 ? 'degraded' : 'healthy')
      : 'unhealthy';

    return {
      status,
      timestamp: this.healthStatus.lastChecked,
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      critical: this.healthStatus.critical,
      warnings: this.healthStatus.warnings,
      components: {
        database: {
          status: this.healthStatus.database ? 'connected' : 'disconnected',
          type: 'MongoDB',
          details: this.healthStatus.services.collections || {}
        },
        fileSystem: {
          status: this.healthStatus.fileSystem ? 'accessible' : 'inaccessible'
        },
        redis: {
          status: this.healthStatus.redisDetails?.status || (this.healthStatus.redis ? 'connected' : 'unavailable'),
          optional: true,
          details: this.healthStatus.redisDetails || {}
        },
        services: this.healthStatus.services
      }
    };
  }
}

module.exports = SystemHealthService;
