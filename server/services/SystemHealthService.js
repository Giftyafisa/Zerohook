const mongoose = require('mongoose');
const { User, Service, Conversation, Message, isDatabaseAvailable } = require('../config/database');

class SystemHealthService {
  constructor() {
    this.healthStatus = {
      database: false,
      redis: false,
      fileSystem: false,
      services: {}
    };
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
    try {
      // Try to connect to Redis if available
      const redis = require('redis');
      const client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });
      
      await client.connect();
      await client.ping();
      await client.disconnect();
      
      this.healthStatus.redis = true;
      return true;
    } catch (error) {
      console.log('Redis not available, continuing without caching');
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
    
    const checks = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkFileSystemHealth(),
      this.checkRedisHealth(),
      this.checkServiceHealth()
    ]);
    
    const overallHealth = checks.every(check => check === true);
    
    this.healthStatus.overall = overallHealth;
    this.healthStatus.lastChecked = new Date().toISOString();
    
    console.log(`🏥 Health check completed: ${overallHealth ? '✅ Healthy' : '❌ Issues detected'}`);
    
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
    return {
      status: this.isHealthy() ? 'healthy' : 'unhealthy',
      timestamp: this.healthStatus.lastChecked,
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
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
          status: this.healthStatus.redis ? 'connected' : 'unavailable'
        },
        services: this.healthStatus.services
      }
    };
  }
}

module.exports = SystemHealthService;
