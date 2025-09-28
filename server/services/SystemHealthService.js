const { query } = require('../config/database');

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
      const result = await query('SELECT 1 as test');
      this.healthStatus.database = result.rows.length > 0;
      return this.healthStatus.database;
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
      // Check if all required tables exist
      const requiredTables = [
        'users', 'services', 'conversations', 'messages',
        'user_connections', 'blocked_users', 'notifications',
        'file_uploads', 'subscription_plans', 'subscriptions'
      ];
      
      const tableChecks = await Promise.all(
        requiredTables.map(async (table) => {
          try {
            const result = await query(`
              SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = $1
              )
            `, [table]);
            return { table, exists: result.rows[0].exists };
          } catch (error) {
            return { table, exists: false, error: error.message };
          }
        })
      );
      
      const missingTables = tableChecks.filter(check => !check.exists);
      this.healthStatus.services.tables = {
        total: requiredTables.length,
        existing: requiredTables.length - missingTables.length,
        missing: missingTables.map(t => t.table)
      };
      
      // Check data counts
      try {
        const userCount = await query('SELECT COUNT(*) FROM users');
        const serviceCount = await query('SELECT COUNT(*) FROM services');
        const connectionCount = await query('SELECT COUNT(*) FROM user_connections');
        
        this.healthStatus.services.data = {
          users: parseInt(userCount.rows[0].count),
          services: parseInt(serviceCount.rows[0].count),
          connections: parseInt(connectionCount.rows[0].count)
        };
      } catch (error) {
        this.healthStatus.services.data = { error: error.message };
      }
      
      return missingTables.length === 0;
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
          details: this.healthStatus.services.tables || {}
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
