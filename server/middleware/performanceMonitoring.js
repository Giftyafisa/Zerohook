const performanceMonitoring = (req, res, next) => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  
  // Capture request details
  const requestDetails = {
    method: req.method,
    url: req.originalUrl,
    endpoint: req.route?.path || req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.userId || null,
    requestSize: req.headers['content-length'] ? parseInt(req.headers['content-length']) : null
  };

  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const endMemory = process.memoryUsage();
    
    // Calculate memory usage
    const memoryDelta = {
      rss: endMemory.rss - startMemory.rss,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      external: endMemory.external - startMemory.external
    };
    
    // Calculate response size
    const responseSize = chunk ? Buffer.byteLength(chunk, encoding) : 0;
    
    // Record API performance metrics
    if (req.performanceMetrics) {
      req.performanceMetrics.recordAPIMetrics(
        requestDetails.endpoint,
        requestDetails.method,
        responseTime,
        res.statusCode,
        requestDetails.userId,
        requestDetails.requestSize,
        responseSize,
        requestDetails.ip,
        requestDetails.userAgent
      );
    }
    
    // Log user activity if user is authenticated
    if (req.userActivityMonitor && requestDetails.userId) {
      req.userActivityMonitor.logUserActivity(requestDetails.userId, {
        actionType: 'api_request',
        actionData: {
          endpoint: requestDetails.endpoint,
          method: requestDetails.method,
          statusCode: res.statusCode,
          responseTime,
          memoryDelta
        },
        ipAddress: requestDetails.ip,
        userAgent: requestDetails.userAgent,
        responseTimeMs: responseTime,
        success: res.statusCode < 400
      });
    }
    
    // Log slow requests
    if (responseTime > 1000) {
      console.warn(`🐌 Slow API request: ${requestDetails.method} ${requestDetails.endpoint} took ${responseTime}ms`);
    }
    
    // Log high memory usage
    if (memoryDelta.heapUsed > 10 * 1024 * 1024) { // 10MB
      console.warn(`💾 High memory usage: ${requestDetails.method} ${requestDetails.endpoint} used ${Math.round(memoryDelta.heapUsed / 1024 / 1024)}MB`);
    }
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

module.exports = performanceMonitoring;


