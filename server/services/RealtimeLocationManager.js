/**
 * RealtimeLocationManager - Uber-Style Real-Time Location Streaming
 * 
 * UBER APPROACH IMPLEMENTATION:
 * ============================
 * 1. WebSocket-based continuous location streaming (every 10-30 seconds for providers)
 * 2. Geospatial indexing using MongoDB 2dsphere for efficient nearest-neighbor queries
 * 3. Location batching for efficient database writes
 * 4. Decay mechanism for stale locations
 * 5. Privacy controls for location sharing
 * 
 * Unlike Uber's 2-5 second updates (for moving vehicles), we use 10-30 seconds
 * since providers are typically stationary or slow-moving.
 */

const { User, UserActivityLog } = require('../config/database');

class RealtimeLocationManager {
  constructor() {
    this.io = null;
    
    // In-memory cache of active provider locations (for fast queries)
    this.activeLocations = new Map(); // userId -> { lat, lng, timestamp, accuracy }
    
    // Batch queue for database writes (reduces DB load)
    this.locationBatchQueue = [];
    this.batchFlushInterval = 30 * 1000; // Flush to DB every 30 seconds
    this._batchRetryCount = 0;
    this._maxBatchRetries = 3; // Maximum retry attempts before dropping batch
    
    // Location update frequency settings
    this.updateIntervals = {
      provider_active: 10 * 1000,    // Providers who are "available" update every 10s
      provider_idle: 60 * 1000,      // Providers who are "idle" update every 60s
      client_browsing: 30 * 1000,    // Clients actively browsing update every 30s
    };
    
    // Stale threshold - locations older than this are considered stale
    this.staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    // H3-style grid cells (simplified - using lat/lng buckets instead of H3 library)
    // This allows efficient "nearby" queries without full table scans
    this.gridResolution = 0.01; // ~1.1km grid cells
  }

  /**
   * Initialize with Socket.io instance
   */
  initialize(io) {
    this.io = io;
    
    // Start batch flush interval
    setInterval(() => this.flushLocationBatch(), this.batchFlushInterval);
    
    // Start stale location cleanup
    setInterval(() => this.cleanupStaleLocations(), 60 * 1000);
    
    console.log('✅ RealtimeLocationManager initialized');
    
    return this;
  }

  /**
   * Register socket event handlers for a connected user
   */
  registerSocketHandlers(socket) {
    // Provider broadcasts their location
    socket.on('location_update', async (data) => {
      await this.handleLocationUpdate(socket.userId, data, socket);
    });

    // Client requests nearby providers
    socket.on('get_nearby_providers', async (data) => {
      const providers = await this.getNearbyProviders(data);
      socket.emit('nearby_providers', providers);
    });

    // Client subscribes/unsubscribes to a geographic area for live provider updates
    socket.on('subscribe_to_area', (data = {}) => {
      const { lat, lng } = data;
      if (this.validateCoordinates(lat, lng)) {
        this.subscribeToArea(socket, parseFloat(lat), parseFloat(lng));
      }
    });

    socket.on('unsubscribe_from_area', () => {
      this.unsubscribeFromArea(socket);
    });

    // Start/stop location sharing
    socket.on('start_location_sharing', () => {
      this.startLocationSharing(socket.userId, socket);
    });

    socket.on('stop_location_sharing', () => {
      this.stopLocationSharing(socket.userId);
    });

    // Handle disconnect - mark location as stale
    socket.on('disconnect', () => {
      this.unsubscribeFromArea(socket);
      this.handleDisconnect(socket.userId);
    });
  }

  /**
   * Handle incoming location update from provider
   * Similar to Uber's driver location pings
   */
  async handleLocationUpdate(userId, data, socket) {
    try {
      const { lat, lng, accuracy, isAvailable = true, heading } = data;

      // Validate coordinates
      if (!this.validateCoordinates(lat, lng)) {
        socket.emit('location_error', { error: 'Invalid coordinates' });
        return;
      }

      const locationData = {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        accuracy: accuracy || 'high',
        heading: heading || null,
        isAvailable,
        timestamp: Date.now(),
        gridCell: this.getGridCell(lat, lng)
      };

      // Update in-memory cache (for fast queries)
      this.activeLocations.set(userId, locationData);

      // Add to batch queue for database persistence
      this.locationBatchQueue.push({
        userId,
        ...locationData
      });

      // Broadcast to nearby clients (within same grid cell or adjacent cells)
      this.broadcastToNearbyClients(userId, locationData);

      // Acknowledge receipt
      socket.emit('location_acknowledged', { timestamp: locationData.timestamp });

    } catch (error) {
      console.error('Location update error:', error);
      socket.emit('location_error', { error: 'Failed to update location' });
    }
  }

  /**
   * Get grid cell for coordinates (simplified H3-style indexing)
   * This allows efficient spatial queries without full table scans
   */
  getGridCell(lat, lng) {
    const latCell = Math.floor(lat / this.gridResolution);
    const lngCell = Math.floor(lng / this.gridResolution);
    return `${latCell}_${lngCell}`;
  }

  /**
   * Get adjacent grid cells (for "nearby" queries)
   */
  getAdjacentCells(gridCell) {
    const [latCell, lngCell] = gridCell.split('_').map(Number);
    const adjacent = [];
    
    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLng = -1; dLng <= 1; dLng++) {
        adjacent.push(`${latCell + dLat}_${lngCell + dLng}`);
      }
    }
    
    return adjacent;
  }

  /**
   * Get nearby providers using in-memory cache (fast!)
   * This is the Uber-style "nearest driver" query
   */
  async getNearbyProviders(options) {
    const { lat, lng, radiusKm = 25, limit = 50, accountType = 'provider' } = options;

    if (!this.validateCoordinates(lat, lng)) {
      return { providers: [], error: 'Invalid coordinates' };
    }

    const userGridCell = this.getGridCell(lat, lng);
    const searchCells = this.getAdjacentCells(userGridCell);
    
    const nearbyProviders = [];
    const now = Date.now();

    // Quick scan of in-memory active locations
    for (const [userId, location] of this.activeLocations) {
      // Skip stale locations
      if (now - location.timestamp > this.staleThreshold) continue;
      
      // Skip unavailable providers
      if (!location.isAvailable) continue;
      
      // Check if in nearby grid cells
      if (!searchCells.includes(location.gridCell)) continue;
      
      // Calculate precise distance
      const distance = this.calculateDistance(lat, lng, location.lat, location.lng);
      
      if (distance <= radiusKm) {
        nearbyProviders.push({
          userId,
          distance: Math.round(distance * 10) / 10,
          lat: location.lat,
          lng: location.lng,
          isOnline: true,
          lastUpdate: location.timestamp
        });
      }
    }

    // Sort by distance (Uber-style: closest first)
    nearbyProviders.sort((a, b) => a.distance - b.distance);

    // Enrich with user data
    const enrichedProviders = await this.enrichProviderData(
      nearbyProviders.slice(0, limit)
    );

    return {
      providers: enrichedProviders,
      totalNearby: nearbyProviders.length,
      searchRadiusKm: radiusKm
    };
  }

  /**
   * Enrich provider location data with profile information
   */
  async enrichProviderData(providers) {
    if (providers.length === 0) return [];

    try {
      const userIds = providers.map(p => p.userId);
      
      const users = await User.find({ _id: { $in: userIds } })
        .select('username profile_data profileData verification_tier verificationTier is_subscribed')
        .lean();

      const userMap = new Map(users.map(u => [u._id.toString(), u]));

      return providers.map(p => {
        const user = userMap.get(p.userId.toString());
        if (!user) return null;

        const profileData = user.profile_data || user.profileData || {};
        const accountType = profileData.accountType;
        if (accountType !== 'provider') return null;
        
        return {
          ...p,
          username: user.username,
          displayName: profileData.firstName || user.username,
          avatar: profileData.profilePicture || profileData.avatar,
          verificationTier: user.verification_tier || user.verificationTier || 1,
          isSubscribed: user.is_subscribed || user.isSubscribed,
          city: profileData.location?.city,
          rating: profileData.rating || 4.5
        };
      }).filter(Boolean);

    } catch (error) {
      console.error('Error enriching provider data:', error);
      return providers;
    }
  }

  /**
   * Broadcast location update to clients interested in this area
   */
  broadcastToNearbyClients(userId, locationData) {
    if (!this.io) return;

    // Broadcast to room based on grid cell
    const gridRooms = this.getAdjacentCells(locationData.gridCell);
    
    for (const room of gridRooms) {
      this.io.to(`grid_${room}`).emit('provider_location_update', {
        providerId: userId,
        lat: locationData.lat,
        lng: locationData.lng,
        isAvailable: locationData.isAvailable,
        timestamp: locationData.timestamp
      });
    }
  }

  /**
   * Allow clients to subscribe to location updates for a geographic area
   */
  subscribeToArea(socket, lat, lng) {
    const gridCell = this.getGridCell(lat, lng);
    const cells = this.getAdjacentCells(gridCell);
    
    // Join rooms for all adjacent cells
    for (const cell of cells) {
      socket.join(`grid_${cell}`);
    }
    
    console.log(`User ${socket.userId} subscribed to area around ${gridCell}`);
  }

  /**
   * Unsubscribe from area updates
   */
  unsubscribeFromArea(socket) {
    const rooms = Array.from(socket.rooms);
    
    for (const room of rooms) {
      if (room.startsWith('grid_')) {
        socket.leave(room);
      }
    }
  }

  /**
   * Flush location batch to database
   */
  async flushLocationBatch() {
    if (this.locationBatchQueue.length === 0) return;

    const batch = [...this.locationBatchQueue];
    this.locationBatchQueue = [];

    try {
      // Group by user and take latest location for each
      const latestByUser = new Map();
      for (const loc of batch) {
        const existing = latestByUser.get(loc.userId);
        if (!existing || loc.timestamp > existing.timestamp) {
          latestByUser.set(loc.userId, loc);
        }
      }

      // Batch update user profiles with latest locations
      const bulkOps = Array.from(latestByUser.values()).map(loc => ({
        updateOne: {
          filter: { _id: loc.userId },
          update: {
            $set: {
              'profile_data.location.coordinates': {
                lat: loc.lat,
                lng: loc.lng
              },
              'profile_data.location.geoPoint': {
                type: 'Point',
                coordinates: [loc.lng, loc.lat]
              },
              'profile_data.location.lastUpdated': new Date(loc.timestamp),
              'profile_data.isLocationSharing': true,
              last_active: new Date()
            }
          }
        }
      }));

      if (bulkOps.length > 0) {
        await User.bulkWrite(bulkOps);
        console.log(`📍 Flushed ${bulkOps.length} location updates to DB`);
      }

    } catch (error) {
      console.error('Error flushing location batch:', error);
      // Re-queue failed updates with retry limit to prevent infinite loops
      this._batchRetryCount++;
      if (this._batchRetryCount <= this._maxBatchRetries) {
        console.warn(`📍 Re-queuing ${batch.length} location updates (retry ${this._batchRetryCount}/${this._maxBatchRetries})`);
        this.locationBatchQueue.push(...batch);
      } else {
        console.error(`📍 Dropping ${batch.length} location updates after ${this._maxBatchRetries} retries`);
        this._batchRetryCount = 0; // Reset for next batch
      }
    }
  }

  /**
   * Clean up stale locations from memory
   */
  cleanupStaleLocations() {
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, location] of this.activeLocations) {
      if (now - location.timestamp > this.staleThreshold) {
        this.activeLocations.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} stale locations`);
    }
  }

  /**
   * Handle user disconnect
   */
  handleDisconnect(userId) {
    const location = this.activeLocations.get(userId);
    if (location) {
      // Mark as unavailable but keep in cache briefly
      location.isAvailable = false;
      location.timestamp = Date.now();
    }
  }

  /**
   * Start location sharing for a user
   */
  startLocationSharing(userId, socket) {
    console.log(`📍 User ${userId} started location sharing`);
    socket.emit('location_sharing_started');
  }

  /**
   * Stop location sharing for a user
   */
  stopLocationSharing(userId) {
    this.activeLocations.delete(userId);
    console.log(`📍 User ${userId} stopped location sharing`);
  }

  /**
   * Validate coordinates
   */
  validateCoordinates(lat, lng) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    
    return (
      !isNaN(latNum) && !isNaN(lngNum) &&
      latNum >= -90 && latNum <= 90 &&
      lngNum >= -180 && lngNum <= 180
    );
  }

  /**
   * Calculate distance using Haversine formula
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Get statistics about active locations
   */
  getStats() {
    const now = Date.now();
    let active = 0;
    let available = 0;
    let stale = 0;

    for (const [, location] of this.activeLocations) {
      if (now - location.timestamp > this.staleThreshold) {
        stale++;
      } else {
        active++;
        if (location.isAvailable) available++;
      }
    }

    return {
      totalTracked: this.activeLocations.size,
      activeNow: active,
      availableNow: available,
      stale,
      batchQueueSize: this.locationBatchQueue.length
    };
  }
}

module.exports = RealtimeLocationManager;
