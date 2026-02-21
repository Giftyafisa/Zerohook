const { AdultService, User } = require('../config/database');

// Escape special regex characters to prevent ReDoS
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class AdultServiceManager {
  constructor() {
    // No pool needed - using Mongoose models
  }

  // Service Categories
  getServiceCategories() {
    return [
      {
        id: 'long-term',
        name: 'Long Term',
        displayName: 'Long Term Relationships',
        description: 'Serious relationships and ongoing arrangements',
        icon: '💕',
        startingPrice: 100,
        maxPrice: 1000,
        duration: 'Ongoing',
        features: ['Regular meetings', 'Emotional connection', 'Trust building', 'Long-term commitment']
      },
      {
        id: 'short-term',
        name: 'Short Term',
        displayName: 'Casual Encounters',
        description: 'Casual dating and one-time services',
        icon: '🔥',
        startingPrice: 150,
        maxPrice: 500,
        duration: 'One-time to few weeks',
        features: ['Quick meetings', 'No strings attached', 'Flexible scheduling', 'Variety of experiences']
      },
      {
        id: 'oral-services',
        name: 'Oral Services',
        displayName: 'Intimate Oral Experiences',
        description: 'Oral services and intimate experiences',
        icon: '💋',
        startingPrice: 80,
        maxPrice: 300,
        duration: 'Per session',
        features: ['Discrete service', 'Professional approach', 'Hygiene focused', 'Satisfaction guaranteed']
      },
      {
        id: 'special-services',
        name: 'Special Services',
        displayName: 'Premium & Exclusive',
        description: 'Premium and exclusive intimate offerings',
        icon: '⭐',
        startingPrice: 200,
        maxPrice: 2000,
        duration: 'Custom',
        features: ['VIP treatment', 'Custom experiences', 'Premium locations', 'Exclusive access']
      }
    ];
  }

  // Create a new service listing
  async createServiceListing(userId, serviceData) {
    const {
      category,
      subcategory,
      title,
      description,
      price,
      duration,
      location,
      availability,
      photos,
      specialRequirements
    } = serviceData;

    try {
      const service = await AdultService.create({
        provider_id: userId,
        category,
        subcategory: subcategory || null,
        title,
        description,
        price,
        duration_minutes: duration,
        location_type: 'flexible',
        location_data: location || {},
        availability: availability || {},
        requirements: specialRequirements || {},
        images: photos || [],
        is_active: true
      });
      
      return service;
    } catch (error) {
      console.error('Error creating service listing:', error);
      throw new Error('Failed to create service listing');
    }
  }

  // Get service listings with filters
  async getServiceListings(filters = {}) {
    try {
      let query = { is_active: true };

      // Add category filter
      if (filters.category) {
        query.category = filters.category;
      }

      // Add price range filter
      if (filters.minPrice || filters.maxPrice) {
        query.price = {};
        if (filters.minPrice) {
          query.price.$gte = filters.minPrice;
        }
        if (filters.maxPrice) {
          query.price.$lte = filters.maxPrice;
        }
      }

      // Add location filter (escaped to prevent ReDoS)
      if (filters.location) {
        const safeLoc = escapeRegExp(String(filters.location));
        query.$or = [
          { 'location_data.city': { $regex: safeLoc, $options: 'i' } },
          { 'location_data.country': { $regex: safeLoc, $options: 'i' } }
        ];
      }

      const services = await AdultService.find(query)
        .populate({
          path: 'provider_id',
          select: 'username verification_tier trust_score profile_data',
          match: filters.verificationTier ? { verification_tier: { $gte: filters.verificationTier } } : {},
        })
        .sort({ created_at: -1 })
        .skip(filters.offset || 0)
        .limit(filters.limit || 20);

      // Filter out services where provider didn't match (due to verification tier filter)
      const filteredServices = services.filter(s => s.provider_id !== null);

      // Transform to expected format
      return filteredServices.map(s => ({
        id: s._id,
        ...s.toObject(),
        user_id: s.provider_id?._id,
        username: s.provider_id?.username,
        verification_tier: s.provider_id?.verification_tier,
        trust_score: s.provider_id?.trust_score || 0,
        avatar: s.provider_id?.profile_data?.avatar,
        profile_picture: s.provider_id?.profile_data?.profilePicture,
        service_verified: s.is_verified
      }));
    } catch (error) {
      console.error('Error getting service listings:', error);
      throw new Error('Failed to get service listings');
    }
  }

  // Get service by ID
  async getServiceById(serviceId) {
    try {
      const service = await AdultService.findOne({ _id: serviceId, is_active: true })
        .populate({
          path: 'provider_id',
          select: 'username verification_tier trust_score profile_data created_at'
        });

      if (!service) return null;

      return {
        id: service._id,
        ...service.toObject(),
        user_id: service.provider_id?._id,
        username: service.provider_id?.username,
        verification_tier: service.provider_id?.verification_tier,
        trust_score: service.provider_id?.trust_score || 0,
        avatar: service.provider_id?.profile_data?.avatar,
        profile_picture: service.provider_id?.profile_data?.profilePicture,
        service_verified: service.is_verified,
        user_joined: service.provider_id?.created_at
      };
    } catch (error) {
      console.error('Error getting service by ID:', error);
      throw new Error('Failed to get service');
    }
  }

  // Update service listing
  async updateServiceListing(serviceId, userId, updateData) {
    try {
      const allowedFields = [
        'title', 'description', 'price', 'duration_minutes', 'category',
        'subcategory', 'location_data', 'availability', 'requirements', 'images'
      ];

      const updates = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          updates[key] = value;
        }
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('No valid fields to update');
      }

      const service = await AdultService.findOneAndUpdate(
        { _id: serviceId, provider_id: userId },
        { $set: updates },
        { new: true }
      );

      return service;
    } catch (error) {
      console.error('Error updating service listing:', error);
      throw new Error('Failed to update service listing');
    }
  }

  // Delete service listing
  async deleteServiceListing(serviceId, userId) {
    try {
      const service = await AdultService.findOneAndUpdate(
        { _id: serviceId, provider_id: userId },
        { $set: { is_active: false } },
        { new: true }
      );

      return service;
    } catch (error) {
      console.error('Error deleting service listing:', error);
      throw new Error('Failed to delete service listing');
    }
  }

  // Get user's service listings
  async getUserServices(userId) {
    try {
      const services = await AdultService.find({
        provider_id: userId,
        is_active: true
      }).sort({ created_at: -1 });

      return services;
    } catch (error) {
      console.error('Error getting user services:', error);
      throw new Error('Failed to get user services');
    }
  }

  // Search services
  async searchServices(searchTerm, filters = {}) {
    try {
      const safeSearch = escapeRegExp(String(searchTerm));
      const query = {
        is_active: true,
        $or: [
          { title: { $regex: safeSearch, $options: 'i' } },
          { description: { $regex: safeSearch, $options: 'i' } },
          { 'location_data.city': { $regex: safeSearch, $options: 'i' } },
          { 'location_data.country': { $regex: safeSearch, $options: 'i' } }
        ]
      };

      if (filters.category) {
        query.category = filters.category;
      }

      if (filters.minPrice) {
        query.price = { ...query.price, $gte: filters.minPrice };
      }

      if (filters.maxPrice) {
        query.price = { ...query.price, $lte: filters.maxPrice };
      }

      const services = await AdultService.find(query)
        .populate({
          path: 'provider_id',
          select: 'username verification_tier trust_score profile_data'
        })
        .sort({ 'provider_id.trust_score': -1, 'provider_id.verification_tier': -1 });

      return services.map(s => ({
        id: s._id,
        ...s.toObject(),
        user_id: s.provider_id?._id,
        username: s.provider_id?.username,
        verification_tier: s.provider_id?.verification_tier,
        trust_score: s.provider_id?.trust_score || 0,
        avatar: s.provider_id?.profile_data?.avatar,
        profile_picture: s.provider_id?.profile_data?.profilePicture,
        service_verified: s.is_verified
      }));
    } catch (error) {
      console.error('Error searching services:', error);
      throw new Error('Failed to search services');
    }
  }

  // Get service statistics
  async getServiceStats() {
    try {
      const stats = await AdultService.aggregate([
        { $match: { is_active: true } },
        {
          $group: {
            _id: '$category',
            total_services: { $sum: 1 },
            avg_price: { $avg: '$price' },
            min_price: { $min: '$price' },
            max_price: { $max: '$price' }
          }
        }
      ]);

      return stats.map(s => ({
        category: s._id,
        total_services: s.total_services,
        avg_price: s.avg_price,
        min_price: s.min_price,
        max_price: s.max_price
      }));
    } catch (error) {
      console.error('Error getting service stats:', error);
      throw new Error('Failed to get service statistics');
    }
  }
}

module.exports = AdultServiceManager;
