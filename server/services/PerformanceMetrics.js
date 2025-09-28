const { query } = require('../config/database');
const os = require('os');

class PerformanceMetrics {
  constructor() {
    this.initialized = false;
    this.metricsBuffer = [];
    this.bufferSize = parseInt(process.env.METRICS_BUFFER_SIZE) || 100;
    this.flushInterval = parseInt(process.env.METRICS_FLUSH_INTERVAL_MS) || 30 * 1000; // 30 seconds
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
        await this.flushMetricsBuffer();
      }

      // Record detailed API log
      await query(`
        INSERT INTO api_performance_logs (
          endpoint, method, user_id, response_time_ms, status_code,
          request_size_bytes, response_size_bytes, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [endpoint, method, userId, responseTime, statusCode, requestSize, responseSize, ipAddress, userAgent]);

      const processingTime = Date.now() - startTime;
      if (processingTime > 10) { // Log if processing takes more than 10ms
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
      // Add to buffer
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

      // Record in performance metrics table
      await query(`
        INSERT INTO performance_metrics (
          metric_type, metric_name, value, unit, metadata
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        'db_query',
        queryType,
        executionTime,
        'ms',
        JSON.stringify({
          queryText: queryText.substring(0, 200),
          rowsAffected,
          success,
          errorMessage
        })
      ]);

    } catch (error) {
      console.error('Error recording database metrics:', error);
    }
  }

  /**
   * Record user interaction metrics
   */
  async recordUserInteraction(userId, interactionType, duration, success = true, metadata = {}) {
    try {
      // Add to buffer
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

      // Record in performance metrics table
      await query(`
        INSERT INTO performance_metrics (
          metric_type, metric_name, value, unit, metadata
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        'user_interaction',
        interactionType,
        duration,
        'ms',
        JSON.stringify({
          userId,
          success,
          ...metadata
        })
      ]);

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
      
      // Record CPU usage
      await query(`
        INSERT INTO performance_metrics (
          metric_type, metric_name, value, unit, metadata
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        'system_resource',
        'cpu_usage',
        metrics.cpuUsage,
        'percent',
        JSON.stringify({ loadAverage: metrics.loadAverage })
      ]);

      // Record memory usage
      await query(`
        INSERT INTO performance_metrics (
          metric_type, metric_name, value, unit, metadata
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        'system_resource',
        'memory_usage',
        metrics.memoryUsage,
        'percent',
        JSON.stringify({ 
          totalMemory: metrics.totalMemory,
          freeMemory: metrics.freeMemory,
          usedMemory: metrics.usedMemory
        })
      ]);

      // Record uptime
      await query(`
        INSERT INTO performance_metrics (
          metric_type, metric_name, value, unit, metadata
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        'system_resource',
        'uptime',
        metrics.uptime,
        'seconds',
        JSON.stringify({ startTime: this.startTime })
      ]);

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
    if (this.metricsBuffer.length === 0) return;

    try {
      const metricsToFlush = [...this.metricsBuffer];
      this.metricsBuffer = [];

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
      this.metricsBuffer.unshift(...this.metricsBuffer);
    }
  }

  /**
   * Process a batch of metrics
   */
  async processMetricsBatch(metrics) {
    try {
      for (const metric of metrics) {
        switch (metric.type) {
          case 'api_performance':
            // Already recorded in recordAPIMetrics
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
    } catch (error) {
      console.error('Error processing metrics batch:', error);
    }
  }

  /**
   * Get performance metrics summary
   */
  async getPerformanceSummary(timeRange = '1 hour') {
    try {
      const [apiMetrics, dbMetrics, systemMetrics] = await Promise.all([
        // API performance summary
        query(`
          SELECT 
            endpoint,
            method,
            COUNT(*) as request_count,
            AVG(response_time_ms) as avg_response_time,
            MIN(response_time_ms) as min_response_time,
            MAX(response_time_ms) as max_response_time,
            COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
          FROM api_performance_logs 
          WHERE created_at > NOW() - INTERVAL '${timeRange}'
          GROUP BY endpoint, method
          ORDER BY request_count DESC
          LIMIT 10
        `),

        // Database performance summary
        query(`
          SELECT 
            metric_name,
            COUNT(*) as query_count,
            AVG(value) as avg_execution_time,
            MIN(value) as min_execution_time,
            MAX(value) as max_execution_time
          FROM performance_metrics 
          WHERE metric_type = 'db_query' AND timestamp > NOW() - INTERVAL '${timeRange}'
          GROUP BY metric_name
          ORDER BY avg_execution_time DESC
          LIMIT 10
        `),

        // System resource summary
        query(`
          SELECT 
            metric_name,
            AVG(value) as avg_value,
            MIN(value) as min_value,
            MAX(value) as max_value
          FROM performance_metrics 
          WHERE metric_type = 'system_resource' AND timestamp > NOW() - INTERVAL '${timeRange}'
          GROUP BY metric_name
        `)
      ]);

      return {
        apiMetrics: apiMetrics.rows,
        databaseMetrics: dbMetrics.rows,
        systemMetrics: systemMetrics.rows,
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
      const result = await query(`
        SELECT 
          DATE_TRUNC('hour', created_at) as hour,
          COUNT(*) as request_count,
          AVG(response_time_ms) as avg_response_time,
          COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
          COUNT(CASE WHEN response_time_ms > 1000 THEN 1 END) as slow_requests
        FROM api_performance_logs 
        WHERE endpoint = $1 AND created_at > NOW() - INTERVAL '${timeRange}'
        GROUP BY DATE_TRUNC('hour', created_at)
        ORDER BY hour DESC
      `, [endpoint]);

      return {
        endpoint,
        timeRange,
        hourlyData: result.rows,
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
      const result = await query(`
        SELECT 
          metric_name,
          value as execution_time,
          metadata,
          timestamp
        FROM performance_metrics 
        WHERE metric_type = 'db_query' 
          AND value > $1
          AND timestamp > NOW() - INTERVAL '24 hours'
        ORDER BY value DESC
        LIMIT $2
      `, [threshold, limit]);

      return {
        threshold,
        slowQueries: result.rows,
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
      const [apiErrors, slowResponses, systemResources] = await Promise.all([
        // API error rate
        query(`
          SELECT 
            COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
            COUNT(*) as total_count
          FROM api_performance_logs 
          WHERE created_at > NOW() - INTERVAL '1 hour'
        `),

        // Slow response rate
        query(`
          SELECT 
            COUNT(CASE WHEN response_time_ms > 1000 THEN 1 END) as slow_count,
            COUNT(*) as total_count
          FROM api_performance_logs 
          WHERE created_at > NOW() - INTERVAL '1 hour'
        `),

        // System resource usage
        query(`
          SELECT 
            metric_name,
            AVG(value) as avg_value
          FROM performance_metrics 
          WHERE metric_type = 'system_resource' 
            AND timestamp > NOW() - INTERVAL '1 hour'
          GROUP BY metric_name
        `)
      ]);

      const apiErrorRate = apiErrors.rows[0]?.total_count > 0 
        ? (apiErrors.rows[0].error_count / apiErrors.rows[0].total_count) * 100 
        : 0;

      const slowResponseRate = slowResponses.rows[0]?.total_count > 0 
        ? (slowResponses.rows[0].slow_count / slowResponses.rows[0].total_count) * 100 
        : 0;

      // Calculate health score (0-100, higher is better)
      let healthScore = 100;
      
      // Deduct points for errors
      healthScore -= Math.min(apiErrorRate * 2, 30); // Max 30 points deduction for errors
      
      // Deduct points for slow responses
      healthScore -= Math.min(slowResponseRate, 20); // Max 20 points deduction for slow responses
      
      // Deduct points for high resource usage
      systemResources.rows.forEach(row => {
        if (row.metric_name === 'cpu_usage' && row.avg_value > 80) {
          healthScore -= Math.min((row.avg_value - 80) * 0.5, 20); // Max 20 points deduction
        }
        if (row.metric_name === 'memory_usage' && row.avg_value > 85) {
          healthScore -= Math.min((row.avg_value - 85) * 0.5, 20); // Max 20 points deduction
        }
      });

      healthScore = Math.max(0, Math.min(100, healthScore));

      return {
        healthScore: Math.round(healthScore),
        metrics: {
          apiErrorRate: Math.round(apiErrorRate * 100) / 100,
          slowResponseRate: Math.round(slowResponseRate * 100) / 100,
          systemResources: systemResources.rows
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
      
      const [apiLogsDeleted, metricsDeleted] = await Promise.all([
        query(`
          DELETE FROM api_performance_logs 
          WHERE created_at < $1
        `, [cutoffDate]),
        
        query(`
          DELETE FROM performance_metrics 
          WHERE timestamp < $1
        `, [cutoffDate])
      ]);

      console.log(`🧹 Cleaned up old metrics: ${apiLogsDeleted.rowCount} API logs, ${metricsDeleted.rowCount} metrics`);
      
      return {
        apiLogsDeleted: apiLogsDeleted.rowCount,
        metricsDeleted: metricsDeleted.rowCount,
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


