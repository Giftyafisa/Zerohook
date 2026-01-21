/**
 * useProfileEngagement - TikTok-style engagement tracking hook
 * 
 * Tracks:
 * - View duration (how long user looks at a profile)
 * - Scroll depth (how far they scroll)
 * - Photo views (which photos they view)
 * - Bio interaction (did they expand/read bio)
 * - Return visits (did they come back to this profile)
 * 
 * Usage:
 * const { startTracking, stopTracking, trackPhotoView, trackBioExpand } = useProfileEngagement(profileId);
 */

import { useCallback, useRef, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';

const useProfileEngagement = (profileId) => {
  const { socket, isConnected } = useSocket();
  
  // Tracking state refs (don't trigger re-renders)
  const trackingRef = useRef({
    startTime: null,
    photoViews: 0,
    maxScrollDepth: 0,
    bioExpanded: false,
    bioExpandTime: null,
    isTracking: false,
    visitCount: 0
  });

  // Session-level visited profiles (for return visit detection)
  const sessionVisitsRef = useRef(new Set());

  /**
   * Start tracking engagement for a profile
   */
  const startTracking = useCallback(() => {
    if (!profileId) return;

    const isReturnVisit = sessionVisitsRef.current.has(profileId);
    sessionVisitsRef.current.add(profileId);

    trackingRef.current = {
      startTime: Date.now(),
      photoViews: 0,
      maxScrollDepth: 0,
      bioExpanded: false,
      bioExpandTime: null,
      isTracking: true,
      visitCount: (trackingRef.current.visitCount || 0) + 1,
      isReturnVisit
    };

    console.log(`📊 Started tracking engagement for profile ${profileId} (return visit: ${isReturnVisit})`);
  }, [profileId]);

  /**
   * Stop tracking and send engagement data
   */
  const stopTracking = useCallback((action = 'exit') => {
    if (!trackingRef.current.isTracking || !profileId) return;

    const tracking = trackingRef.current;
    const viewDuration = Date.now() - tracking.startTime;
    
    // Calculate bio read time if bio was expanded
    let bioReadTime = 0;
    if (tracking.bioExpanded && tracking.bioExpandTime) {
      bioReadTime = Date.now() - tracking.bioExpandTime;
    }

    const engagementData = {
      profileId,
      viewDuration,
      photoViews: tracking.photoViews,
      scrollDepth: tracking.maxScrollDepth,
      bioExpanded: tracking.bioExpanded,
      bioReadTime,
      isReturnVisit: tracking.isReturnVisit,
      action
    };

    // Send to server via WebSocket
    if (socket && isConnected) {
      socket.emit('profile_engagement', engagementData);
    }

    // Also send via API for non-WebSocket fallback
    sendEngagementAPI(engagementData);

    console.log(`📊 Stopped tracking profile ${profileId}:`, {
      duration: Math.round(viewDuration / 1000) + 's',
      photos: tracking.photoViews,
      scroll: tracking.maxScrollDepth + '%',
      action
    });

    trackingRef.current.isTracking = false;
  }, [profileId, socket, isConnected]);

  /**
   * Track photo view
   */
  const trackPhotoView = useCallback((photoIndex) => {
    if (!trackingRef.current.isTracking) return;
    trackingRef.current.photoViews = Math.max(
      trackingRef.current.photoViews,
      photoIndex + 1
    );
  }, []);

  /**
   * Track scroll depth (0-100%)
   */
  const trackScrollDepth = useCallback((depth) => {
    if (!trackingRef.current.isTracking) return;
    trackingRef.current.maxScrollDepth = Math.max(
      trackingRef.current.maxScrollDepth,
      Math.min(100, Math.round(depth))
    );
  }, []);

  /**
   * Track bio expand
   */
  const trackBioExpand = useCallback(() => {
    if (!trackingRef.current.isTracking) return;
    if (!trackingRef.current.bioExpanded) {
      trackingRef.current.bioExpanded = true;
      trackingRef.current.bioExpandTime = Date.now();
    }
  }, []);

  /**
   * Track contact button click
   */
  const trackContactClick = useCallback(() => {
    stopTracking('contact');
  }, [stopTracking]);

  /**
   * Track favorite action
   */
  const trackFavorite = useCallback(() => {
    if (!trackingRef.current.isTracking || !profileId) return;
    
    const engagementData = {
      profileId,
      viewDuration: Date.now() - trackingRef.current.startTime,
      photoViews: trackingRef.current.photoViews,
      scrollDepth: trackingRef.current.maxScrollDepth,
      bioExpanded: trackingRef.current.bioExpanded,
      bioReadTime: 0,
      isReturnVisit: trackingRef.current.isReturnVisit,
      action: 'favorite'
    };

    if (socket && isConnected) {
      socket.emit('profile_engagement', engagementData);
    }
  }, [profileId, socket, isConnected]);

  /**
   * Track skip/swipe away (negative signal)
   */
  const trackSkip = useCallback(() => {
    stopTracking('skip');
  }, [stopTracking]);

  // Cleanup on unmount or profile change
  useEffect(() => {
    return () => {
      if (trackingRef.current.isTracking) {
        stopTracking('exit');
      }
    };
  }, [stopTracking, profileId]);

  return {
    startTracking,
    stopTracking,
    trackPhotoView,
    trackScrollDepth,
    trackBioExpand,
    trackContactClick,
    trackFavorite,
    trackSkip,
    isTracking: trackingRef.current.isTracking
  };
};

/**
 * Send engagement data via API (fallback for WebSocket)
 */
const sendEngagementAPI = async (data) => {
  try {
    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const token = localStorage.getItem('token');
    
    await fetch(`${API_BASE_URL}/api/users/engagement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify(data)
    });
  } catch (error) {
    // Silent fail - engagement tracking shouldn't interrupt UX
    console.debug('Engagement API fallback failed:', error);
  }
};

export default useProfileEngagement;
