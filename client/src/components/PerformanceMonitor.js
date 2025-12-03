import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Collapse,
  IconButton,
  Alert,
  LinearProgress
} from '@mui/material';
import {
  Speed,
  Memory,
  NetworkCheck,
  ExpandMore,
  ExpandLess,
  Refresh,
  Warning
} from '@mui/icons-material';
import { API_BASE_URL } from '../config/constants';

const PerformanceMonitor = ({ show = false }) => {
  const [expanded, setExpanded] = useState(false);
  const [metrics, setMetrics] = useState({
    loadTime: 0,
    memoryUsage: 0,
    networkLatency: 0,
    renderTime: 0,
    bundleSize: 0
  });
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    if (show && expanded) {
      startMonitoring();
    }
  }, [show, expanded]);

  const startMonitoring = async () => {
    setIsMonitoring(true);
    
    // Measure page load time
    const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
    
    // Measure memory usage (if available)
    const memoryInfo = performance.memory;
    const memoryUsage = memoryInfo ? 
      Math.round((memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize) * 100) : 0;
    
    // Measure network latency
    const networkLatency = await measureNetworkLatency();
    
    // Measure render time
    const renderTime = measureRenderTime();
    
    // Estimate bundle size
    const bundleSize = estimateBundleSize();
    
    setMetrics({
      loadTime,
      memoryUsage,
      networkLatency,
      renderTime,
      bundleSize
    });
    
    setIsMonitoring(false);
  };

  const measureNetworkLatency = async () => {
    const start = performance.now();
    try {
      await fetch(`${API_BASE_URL}/health`, { method: 'HEAD' });
      return Math.round(performance.now() - start);
    } catch {
      return 0;
    }
  };

  const measureRenderTime = () => {
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return fcp ? Math.round(fcp.startTime) : 0;
  };

  const estimateBundleSize = () => {
    // This is a rough estimate based on the build output
    return 320; // KB from the build output
  };

  const getPerformanceColor = (value, thresholds) => {
    if (value <= thresholds.good) return 'success';
    if (value <= thresholds.warning) return 'warning';
    return 'error';
  };

  const getPerformanceLabel = (value, thresholds) => {
    if (value <= thresholds.good) return 'Excellent';
    if (value <= thresholds.warning) return 'Good';
    return 'Needs Improvement';
  };

  if (!show) return null;

  return (
    <Card sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000, maxWidth: 300 }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" display="flex" alignItems="center" gap={1}>
            <Speed />
            Performance
          </Typography>
          <Box>
            <IconButton
              size="small"
              onClick={startMonitoring}
              disabled={isMonitoring}
            >
              <Refresh />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        </Box>

        {isMonitoring && (
          <Box mb={2}>
            <LinearProgress />
            <Typography variant="caption" color="text.secondary">
              Measuring performance...
            </Typography>
          </Box>
        )}

        {/* Quick Metrics */}
        <Box display="flex" gap={1} mb={2} flexWrap="wrap">
          <Chip
            icon={<Speed />}
            label={`${metrics.loadTime}ms`}
            color={getPerformanceColor(metrics.loadTime, { good: 1000, warning: 3000 })}
            size="small"
          />
          <Chip
            icon={<Memory />}
            label={`${metrics.memoryUsage}%`}
            color={getPerformanceColor(metrics.memoryUsage, { good: 50, warning: 80 })}
            size="small"
          />
          <Chip
            icon={<NetworkCheck />}
            label={`${metrics.networkLatency}ms`}
            color={getPerformanceColor(metrics.networkLatency, { good: 100, warning: 500 })}
            size="small"
          />
        </Box>

        {/* Detailed Metrics */}
        <Collapse in={expanded}>
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Detailed Metrics
            </Typography>
            
            <Box mb={2}>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2">Page Load Time</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {metrics.loadTime}ms
                </Typography>
              </Box>
              <Chip
                label={getPerformanceLabel(metrics.loadTime, { good: 1000, warning: 3000 })}
                color={getPerformanceColor(metrics.loadTime, { good: 1000, warning: 3000 })}
                size="small"
              />
            </Box>

            <Box mb={2}>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2">Memory Usage</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {metrics.memoryUsage}%
                </Typography>
              </Box>
              <Chip
                label={getPerformanceLabel(metrics.memoryUsage, { good: 50, warning: 80 })}
                color={getPerformanceColor(metrics.memoryUsage, { good: 50, warning: 80 })}
                size="small"
              />
            </Box>

            <Box mb={2}>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2">Network Latency</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {metrics.networkLatency}ms
                </Typography>
              </Box>
              <Chip
                label={getPerformanceLabel(metrics.networkLatency, { good: 100, warning: 500 })}
                color={getPerformanceColor(metrics.networkLatency, { good: 100, warning: 500 })}
                size="small"
              />
            </Box>

            <Box mb={2}>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2">First Contentful Paint</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {metrics.renderTime}ms
                </Typography>
              </Box>
              <Chip
                label={getPerformanceLabel(metrics.renderTime, { good: 1000, warning: 2500 })}
                color={getPerformanceColor(metrics.renderTime, { good: 1000, warning: 2500 })}
                size="small"
              />
            </Box>

            <Box mb={2}>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2">Bundle Size</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {metrics.bundleSize}KB
                </Typography>
              </Box>
              <Chip
                label={getPerformanceLabel(metrics.bundleSize, { good: 200, warning: 500 })}
                color={getPerformanceColor(metrics.bundleSize, { good: 200, warning: 500 })}
                size="small"
              />
            </Box>

            {/* Performance Recommendations */}
            {(metrics.loadTime > 3000 || metrics.memoryUsage > 80 || metrics.networkLatency > 500) && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="caption">
                  <strong>Performance Tips:</strong>
                  <br />
                  • Enable compression on your server
                  <br />
                  • Use a CDN for static assets
                  <br />
                  • Implement lazy loading for images
                  <br />
                  • Consider code splitting
                </Typography>
              </Alert>
            )}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default PerformanceMonitor;

