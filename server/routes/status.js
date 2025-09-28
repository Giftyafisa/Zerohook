const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./auth');

/**
 * @route   GET /api/status/users/online
 * @desc    Get online users count
 * @access  Public
 */
router.get('/users/online', async (req, res) => {
  try {
    const onlineCount = await req.userActivityMonitor.getOnlineUsersCount();
    
    res.json({
      success: true,
      onlineUsers: onlineCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting online users count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get online users count',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/status/users/:userId/presence
 * @desc    Get user presence status
 * @access  Public
 */
router.get('/users/:userId/presence', async (req, res) => {
  try {
    const { userId } = req.params;
    const presence = await req.userActivityMonitor.getUserPresence(userId);
    
    res.json({
      success: true,
      userId,
      presence,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting user presence:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user presence',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/status/system/performance
 * @desc    Get system performance metrics
 * @access  Private
 */
router.get('/system/performance', authMiddleware, async (req, res) => {
  try {
    const [performanceSummary, healthScore] = await Promise.all([
      req.performanceMetrics.getPerformanceSummary('1 hour'),
      req.performanceMetrics.getSystemHealthScore()
    ]);
    
    res.json({
      success: true,
      performance: performanceSummary,
      healthScore,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting system performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system performance',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/status/system/activity
 * @desc    Get system activity overview
 * @access  Private
 */
router.get('/system/activity', authMiddleware, async (req, res) => {
  try {
    const activityOverview = await req.userActivityMonitor.getSystemActivityOverview();
    
    res.json({
      success: true,
      activity: activityOverview,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting system activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system activity',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/status/users/:userId/activity
 * @desc    Get user activity summary
 * @access  Private
 */
router.get('/users/:userId/activity', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 7 } = req.query;
    
    // Only allow users to view their own activity or admin users
    if (req.user.userId !== userId && req.user.verification_tier < 4) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    const activitySummary = await req.userActivityMonitor.getUserActivitySummary(userId, parseInt(days));
    
    res.json({
      success: true,
      userId,
      activitySummary,
      days: parseInt(days),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting user activity summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user activity summary',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/status/endpoints/:endpoint/performance
 * @desc    Get specific endpoint performance
 * @access  Private
 */
router.get('/endpoints/:endpoint/performance', authMiddleware, async (req, res) => {
  try {
    const { endpoint } = req.params;
    const { timeRange = '24 hours' } = req.query;
    
    // Only allow admin users to view endpoint performance
    if (req.user.verification_tier < 4) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }
    
    const endpointPerformance = await req.performanceMetrics.getEndpointPerformance(endpoint, timeRange);
    
    res.json({
      success: true,
      endpointPerformance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting endpoint performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get endpoint performance',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/status/database/slow-queries
 * @desc    Get slow database queries
 * @access  Private (Admin only)
 */
router.get('/database/slow-queries', authMiddleware, async (req, res) => {
  try {
    // Only allow admin users to view slow queries
    if (req.user.verification_tier < 4) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }
    
    const { threshold = 1000, limit = 20 } = req.query;
    const slowQueries = await req.performanceMetrics.getSlowQueries(parseInt(threshold), parseInt(limit));
    
    res.json({
      success: true,
      slowQueries,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting slow queries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get slow queries',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/status/overview
 * @desc    Get comprehensive system status overview
 * @access  Private
 */
router.get('/overview', authMiddleware, async (req, res) => {
  try {
    const [systemHealth, performanceSummary, activityOverview, healthScore] = await Promise.all([
      req.systemHealth.getDetailedStatus(),
      req.performanceMetrics.getPerformanceSummary('1 hour'),
      req.userActivityMonitor.getSystemActivityOverview(),
      req.performanceMetrics.getSystemHealthScore()
    ]);
    
    res.json({
      success: true,
      overview: {
        systemHealth,
        performance: performanceSummary,
        activity: activityOverview,
        healthScore,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting system overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system overview',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;


