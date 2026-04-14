const { ApiPerformanceLog, isDatabaseAvailable } = require('../config/database');
const os = require('os');

class PerformanceMetrics {
  constructor() {
    this.initialized = false;
    this.metricsBuffer = [];
    this.bufferSize = parseInt(process.env.METRICS_BUFFER_SIZE) || 100;
    this.flushInterval = parseInt(process.env.METRICS_FLUSH_INTERVAL_MS) || 30 * 1000; // 30 seconds
    this.warnThresholdMs = parseInt(process.env.METRICS_RECORD_WARN_THRESHOLD_MS, 10) || 250;
    this.flushInProgress = false;
    this.flushTimer = null;
    this.startTime = Date.now();
  }

  async initialize() {
    try {
      console.log('🔄 Initializing PerformanceMetrics...');
      
      // Set up periodic metrics flush
      this.flushTimer = setInterval(async () => {
        await this.flushMetricsBuffer();
      }, this.flushInterval);
      
      this.initialized = true;
      console.log('✅ PerformanceMetrics initialized successfully');
    } catch (error) {
      console.error('❌ PerformanceMetrics initialization failed:', error);
      throw error;
    }
  }

  isHealthy() {
    return this.initialized;
  }

  /**
   * Record API performance metrics
   */
  async recordAPIMetrics(endpoint, method, responseTime, statusCode, userId = null, requestSize = null, responseSize = null, ipAddress = null, userAgent = null) {
    try {
      const startTime = Date.now();
      
      // Add to buffer for batch processing
      this.metricsBuffer.push({
        type: 'api_performance',
        data: {
          endpoint,
          method,
          responseTime,
          statusCode,
          userId,
          requestSize,
          responseSize,
          ipAddress,
          userAgent,
          timestamp: new Date()
        }
      });

      // Flush buffer if it's full
      if (this.metricsBuffer.length >= this.bufferSize) {
        // Non-blocking flush to avoid adding latency to API responses.
        this.flushMetricsBuffer().catch(() => {});
      }

      const processingTime = Date.now() - startTime;
      if (processingTime > this.warnThresholdMs) {
        console.warn(`⚠️  API metrics recording took ${processingTime}ms for ${endpoint}`);
      }

    } catch (error) {
      console.error('Error recording API metrics:', error);
      // Don't throw error to avoid breaking API responses
    }
  }

  /**
   * Record database query performance
   */
  async recordDatabaseMetrics(queryType, queryText, executionTime, rowsAffected, success = true, errorMessage = null) {
    try {
      // Add to buffer only - MongoDB doesn't need a separate performance_metrics table
      this.metricsBuffer.push({
        type: 'database_performance',
        data: {
          queryType,
          queryText: queryText.substring(0, 200), // Truncate long queries
          executionTime,
          rowsAffected,
          success,
          errorMessage,
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error('Error recording database metrics:', error);
    }
  }

  /**
   * Record user interaction metrics
   */
  async recordUserInteraction(userId, interactionType, duration, success = true, metadata = {}) {
    try {
      // Add to buffer only for MongoDB
      this.metricsBuffer.push({
        type: 'user_interaction',
        data: {
          userId,
          interactionType,
          duration,
          success,
          metadata,
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error('Error recording user interaction metrics:', error);
    }
  }

  /**
   * Record system resource metrics
   */
  async recordSystemMetrics() {
    try {
      const metrics = this.gatherSystemMetrics();
      
      // For MongoDB, we just add to the buffer - no separate performance_metrics table needed
      this.metricsBuffer.push({
        type: 'system_resource',
        data: {
          cpuUsage: metrics.cpuUsage,
          memoryUsage: metrics.memoryUsage,
          uptime: metrics.uptime,
          loadAverage: metrics.loadAverage,
          totalMemory: metrics.totalMemory,
          freeMemory: metrics.freeMemory,
          usedMemory: metrics.usedMemory,
          startTime: this.startTime,
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error('Error recording system metrics:', error);
    }
  }

  /**
   * Gather system resource metrics
   */
  gatherSystemMetrics() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = ((usedMemory / totalMemory) * 100).toFixed(2);
    
    const loadAverage = os.loadavg();
    const cpuUsage = (loadAverage[0] * 100).toFixed(2);
    
    const uptime = os.uptime();

    return {
      cpuUsage: parseFloat(cpuUsage),
      loadAverage: loadAverage.map(load => parseFloat(load.toFixed(2))),
      memoryUsage: parseFloat(memoryUsage),
      totalMemory: totalMemory,
      freeMemory: freeMemory,
      usedMemory: usedMemory,
      uptime: uptime
    };
  }

  /**
   * Flush metrics buffer to database
   */
  async flushMetricsBuffer() {
    if (this.metricsBuffer.length === 0 || this.flushInProgress) return;

    let metricsToFlush = [];
    try {
      this.flushInProgress = true;
      metricsToFlush = this.metricsBuffer.splice(0, this.metricsBuffer.length);

      // Process metrics in batches
      const batchSize = 50;
      for (let i = 0; i < metricsToFlush.length; i += batchSize) {
        const batch = metricsToFlush.slice(i, i + batchSize);
        await this.processMetricsBatch(batch);
      }

      console.log(`📊 Flushed ${metricsToFlush.length} metrics to database`);
    } catch (error) {
      console.error('Error flushing metrics buffer:', error);
      // Restore metrics to buffer on error
      this.metricsBuffer.unshift(...metricsToFlush);
    } finally {
      this.flushInProgress = false;
    }
  }

  /**
   * Process a batch of metrics
   */
  async processMetricsBatch(metrics) {
    try {
      const apiDocs = [];

      for (const metric of metrics) {
        switch (metric.type) {
          case 'api_performance':
            apiDocs.push({
              endpoint: metric.data.endpoint,
              method: metric.data.method,
              user_id: metric.data.userId,
              response_time_ms: metric.data.responseTime,
              status_code: metric.data.statusCode,
              request_size_bytes: metric.data.requestSize,
              response_size_bytes: metric.data.responseSize,
              ip_address: metric.data.ipAddress,
              user_agent: metric.data.userAgent,
              created_at: metric.data.timestamp,
              updated_at: metric.data.timestamp
            });
            break;
          case 'database_performance':
            // Already recorded in recordDatabaseMetrics
            break;
          case 'user_interaction':
            // Already recorded in recordUserInteraction
            break;
          default:
            console.warn(`Unknown metric type: ${metric.type}`);
        }
      }

      if (apiDocs.length > 0 && isDatabaseAvailable()) {
        try {
          await ApiPerformanceLog.insertMany(apiDocs, { ordered: false });
        } catch (dbError) {
          // Silently fail - do not impact request flow
        }
      }
    } catch (error) {
      console.error('Error processing metrics batch:', error);
    }
  }

  /**
   * Get performance metrics summary
   */
  async getPerformanceSummary(timeRange = '1 hour') {
    try {
      // Use MongoDB aggregation for API performance summary
      const timeRangeMs = timeRange === '1 hour' ? 3600000 : 
                          timeRange === '24 hours' ? 86400000 : 3600000;
      const cutoffDate = new Date(Date.now() - timeRangeMs);

      const apiMetrics = await ApiPerformanceLog.aggregate([
        { $match: { created_at: { $gt: cutoffDate } } },
        { $group: {
          _id: { endpoint: '$endpoint', method: '$method' },
          request_count: { $sum: 1 },
          avg_response_time: { $avg: '$response_time_ms' },
          min_response_time: { $min: '$response_time_ms' },
          max_response_time: { $max: '$response_time_ms' },
          error_count: { $sum: { $cond: [{ $gte: ['$status_code', 400] }, 1, 0] } }
        }},
        { $sort: { request_count: -1 } },
        { $limit: 10 }
      ]).catch(() => []);

      return {
        apiMetrics: apiMetrics.map(m => ({
          endpoint: m._id.endpoint,
          method: m._id.method,
          ...m
        })),
        databaseMetrics: [],
        systemMetrics: [],
        timestamp: new Date().toISOString(),
        timeRange
      };
    } catch (error) {
      console.error('Error getting performance summary:', error);
      return {
        apiMetrics: [],
        databaseMetrics: [],
        systemMetrics: [],
        timestamp: new Date().toISOString(),
        timeRange,
        error: error.message
      };
    }
  }

  /**
   * Get endpoint performance analysis
   */
  async getEndpointPerformance(endpoint, timeRange = '24 hours') {
    try {
      const timeRangeMs = timeRange === '24 hours' ? 86400000 : 3600000;
      const cutoffDate = new Date(Date.now() - timeRangeMs);

      const hourlyData = await ApiPerformanceLog.aggregate([
        { $match: { endpoint, created_at: { $gt: cutoffDate } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$created_at' } },
          request_count: { $sum: 1 },
          avg_response_time: { $avg: '$response_time_ms' },
          error_count: { $sum: { $cond: [{ $gte: ['$status_code', 400] }, 1, 0] } },
          slow_requests: { $sum: { $cond: [{ $gt: ['$response_time_ms', 1000] }, 1, 0] } }
        }},
        { $sort: { _id: -1 } }
      ]).catch(() => []);

      return {
        endpoint,
        timeRange,
        hourlyData: hourlyData.map(h => ({ hour: h._id, ...h })),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting endpoint performance:', error);
      return {
        endpoint,
        timeRange,
        hourlyData: [],
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Get slow queries analysis
   */
  async getSlowQueries(threshold = 1000, limit = 20) {
    try {
      // For MongoDB, we just return from buffer since we don't store separate query metrics
      const slowQueries = this.metricsBuffer
        .filter(m => m.type === 'database_performance' && m.data.executionTime > threshold)
        .slice(-limit)
        .map(m => ({
          metric_name: m.data.queryType,
          execution_time: m.data.executionTime,
          metadata: m.data,
          timestamp: m.data.timestamp
        }));

      return {
        threshold,
        slowQueries,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting slow queries:', error);
      return {
        threshold,
        slowQueries: [],
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Get system health score
   */
  async getSystemHealthScore() {
    try {
      const cutoffDate = new Date(Date.now() - 3600000); // 1 hour ago
      
      const [apiStats, systemMetrics] = await Promise.all([
        // API error and slow response rate
        ApiPerformanceLog.aggregate([
          { $match: { created_at: { $gt: cutoffDate } } },
          { $group: {
            _id: null,
            total_count: { $sum: 1 },
            error_count: { $sum: { $cond: [{ $gte: ['$status_code', 400] }, 1, 0] } },
            slow_count: { $sum: { $cond: [{ $gt: ['$response_time_ms', 1000] }, 1, 0] } }
          }}
        ]).catch(() => []),
        
        // Get system metrics from buffer
        Promise.resolve(this.metricsBuffer.filter(m => m.type === 'system_resource').slice(-10))
      ]);

      const stats = apiStats[0] || { total_count: 0, error_count: 0, slow_count: 0 };
      const apiErrorRate = stats.total_count > 0 
        ? (stats.error_count / stats.total_count) * 100 
        : 0;

      const slowResponseRate = stats.total_count > 0 
        ? (stats.slow_count / stats.total_count) * 100 
        : 0;

      // Calculate health score (0-100, higher is better)
      let healthScore = 100;
      
      // Deduct points for errors
      healthScore -= Math.min(apiErrorRate * 2, 30); // Max 30 points deduction for errors
      
      // Deduct points for slow responses
      healthScore -= Math.min(slowResponseRate, 20); // Max 20 points deduction for slow responses
      
      // Deduct points for high resource usage
      systemMetrics.forEach(m => {
        if (m.data.cpuUsage && parseFloat(m.data.cpuUsage) > 80) {
          healthScore -= Math.min((parseFloat(m.data.cpuUsage) - 80) * 0.5, 20);
        }
        if (m.data.memoryUsage && parseFloat(m.data.memoryUsage) > 85) {
          healthScore -= Math.min((parseFloat(m.data.memoryUsage) - 85) * 0.5, 20);
        }
      });

      healthScore = Math.max(0, Math.min(100, healthScore));

      return {
        healthScore: Math.round(healthScore),
        metrics: {
          apiErrorRate: Math.round(apiErrorRate * 100) / 100,
          slowResponseRate: Math.round(slowResponseRate * 100) / 100,
          systemResources: systemMetrics.map(m => m.data)
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error calculating system health score:', error);
      return {
        healthScore: 0,
        metrics: {},
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Clean up old metrics data
   */
  async cleanupOldMetrics(retentionDays = 30) {
    try {
      const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
      
      const result = await ApiPerformanceLog.deleteMany({ created_at: { $lt: cutoffDate } });

      console.log(`🧹 Cleaned up old metrics: ${result.deletedCount} API logs`);
      
      return {
        apiLogsDeleted: result.deletedCount,
        metricsDeleted: 0,
        retentionDays,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error cleaning up old metrics:', error);
      throw error;
    }
  }

  /**
   * Shutdown cleanup
   */
  async shutdown() {
    try {
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
      }
      
      // Flush remaining metrics
      await this.flushMetricsBuffer();
      
      console.log('✅ PerformanceMetrics shutdown completed');
    } catch (error) {
      console.error('Error during PerformanceMetrics shutdown:', error);
    }
  }
}

module.exports = PerformanceMetrics;


