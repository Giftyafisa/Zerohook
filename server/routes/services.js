const express = require('express');
const { authMiddleware } = require('./auth');
const requireSubscription = require('../middleware/requireSubscription');
const mongoose = require('mongoose');
const { Service, ServiceCategory, User, isDatabaseAvailable } = require('../config/database');
const router = express.Router();

// Mock services for when database is unavailable
const mockServices = [
  {
    id: 'mock-service-1',
    title: 'Premium Dating Service',
    description: 'High-quality dating service with verified profiles',
    price: 150,
    duration_minutes: 60,
    location_type: 'flexible',
    category_name: 'Long Term',
    provider_username: 'sarah_professional',
    verification_tier: 3,
    reputation_score: 95,
    rating: 4.8,
    views: 127,
    bookings: 45,
    created_at: new Date().toISOString()
  },
  {
    id: 'mock-service-2',
    title: 'Casual Encounters',
    description: 'Casual dating and short-term connections',
    price: 100,
    duration_minutes: 120,
    location_type: 'fixed',
    category_name: 'Short Term',
    provider_username: 'grace_elegant',
    verification_tier: 2,
    reputation_score: 88,
    rating: 4.5,
    views: 89,
    bookings: 32,
    created_at: new Date().toISOString()
  }
];

const mockCategories = [
  { id: 'cat-1', name: 'long_term', display_name: 'Long Term', description: 'Serious relationships', base_price: 100 },
  { id: 'cat-2', name: 'short_term', display_name: 'Short Term', description: 'Casual encounters', base_price: 150 },
  { id: 'cat-3', name: 'special', display_name: 'Special Services', description: 'Premium offerings', base_price: 200 }
];

/**
 * @route   GET /api/services
 * @desc    Get all services with filters
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    // Check if database is available - return mock data if not
    if (!isDatabaseAvailable()) {
      console.log('⚠️  Database unavailable, returning mock services');
      return res.json({
        services: mockServices,
        pagination: { page: 1, limit: 20, hasMore: false },
        metadata: { mockData: true, message: 'Database temporarily unavailable' }
      });
    }

    const { category, minPrice, maxPrice, page = 1, limit = 20, sort = 'recommended' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const filter = { status: 'active' };

    if (category && category !== 'all') {
      const categoryDoc = await ServiceCategory.findOne({ name: category }).select('_id').lean();
      if (categoryDoc) {
        filter.category_id = categoryDoc._id;
      } else {
        return res.json({
          services: [],
          pagination: { page: pageNum, limit: limitNum, hasMore: false }
        });
      }
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    let sortBy = { created_at: -1 };
    if (sort === 'price_low') sortBy = { price: 1 };
    if (sort === 'price_high') sortBy = { price: -1 };
    if (sort === 'newest') sortBy = { created_at: -1 };

    const services = await Service.find(filter)
      .populate({ path: 'category_id', select: 'display_name name' })
      .populate({ path: 'provider_id', select: 'username profile_data verification_tier reputation_score last_active' })
      .sort(sortBy)
      .skip(offset)
      .limit(limitNum)
      .lean();

    const formattedServices = services.map((service) => ({
      id: service._id.toString(),
      provider_id: service.provider_id?._id?.toString() || null,
      title: service.title,
      description: service.description,
      price: service.price,
      duration_minutes: service.duration_minutes,
      location_type: service.location_type,
      location_data: service.location_data,
      media_urls: service.media_urls,
      views: service.views,
      bookings: service.bookings,
      rating: service.rating,
      created_at: service.created_at,
      category_name: service.category_id?.display_name || null,
      provider_username: service.provider_id?.username || null,
      provider_avatar: service.provider_id?.profile_data?.avatar || null,
      verification_tier: service.provider_id?.verification_tier || 1,
      reputation_score: service.provider_id?.reputation_score || 0,
      last_active: service.provider_id?.last_active || null,
      is_online: service.provider_id?.last_active
        ? (Date.now() - new Date(service.provider_id.last_active).getTime()) <= 15 * 60 * 1000
        : false,
      distance: null
    }));

    res.json({
      services: formattedServices,
      pagination: {
        page: pageNum,
        limit: limitNum,
        hasMore: formattedServices.length === limitNum
      }
    });

  } catch (error) {
    console.error('Get services error:', error);
    
    // In development: return mock data on database error so UI can still function
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️ [DEV] Returning mock services data due to error:', error.message);
      return res.json({
        services: mockServices,
        pagination: { page: 1, limit: 20, hasMore: false },
        metadata: { mockData: true, message: 'Database temporarily unavailable' }
      });
    }
    
    // In production: return proper error (don't mask real bugs with fake data)
    res.status(500).json({
      success: false,
      error: 'Failed to get services'
    });
  }
});

/**
 * @route   GET /api/services/categories
 * @desc    Get all service categories
 * @access  Public
 */
router.get('/categories', async (req, res) => {
  try {
    // Check if database is available - return mock data if not
    if (!isDatabaseAvailable()) {
      console.log('⚠️  Database unavailable, returning mock categories');
      return res.json({
        success: true,
        categories: mockCategories,
        metadata: { mockData: true }
      });
    }

    const categoriesResult = await ServiceCategory
      .find({})
      .select('_id name display_name description base_price')
      .sort({ display_name: 1 })
      .lean();

    const categories = categoriesResult.map((category) => ({
      id: category._id.toString(),
      name: category.name,
      display_name: category.display_name,
      description: category.description,
      base_price: category.base_price
    }));

    res.json({
      success: true,
      categories
    });

  } catch (error) {
    console.error('Get categories error:', error);
    
    // Return mock data on database error
    if (error.message.includes('Connection') || error.message.includes('timeout') || error.message.includes('unavailable')) {
      return res.json({
        success: true,
        categories: mockCategories,
        metadata: { mockData: true }
      });
    }
    
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

/**
 * @route   GET /api/services/user-services
 * @desc    Get services for a specific user
 * @access  Private
 */
router.get('/user-services', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    const servicesResult = await Service.find({ provider_id: userId })
      .populate({ path: 'category_id', select: 'display_name' })
      .populate({ path: 'provider_id', select: 'username verification_tier reputation_score' })
      .sort({ created_at: -1 })
      .lean();

    const services = servicesResult.map((service) => ({
      id: service._id.toString(),
      title: service.title,
      description: service.description,
      price: service.price,
      duration_minutes: service.duration_minutes,
      location_type: service.location_type,
      location_data: service.location_data,
      media_urls: service.media_urls,
      views: service.views,
      bookings: service.bookings,
      rating: service.rating,
      status: service.status,
      created_at: service.created_at,
      category_name: service.category_id?.display_name || null,
      provider_username: service.provider_id?.username || null,
      verification_tier: service.provider_id?.verification_tier || 1,
      reputation_score: service.provider_id?.reputation_score || 0
    }));

    res.json({
      services
    });

  } catch (error) {
    console.error('Get user services error:', error);
    res.status(500).json({
      error: 'Failed to get user services'
    });
  }
});

/**
 * @route   GET /api/services/:id
 * @desc    Get service by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const serviceId = req.params.id;
    
    console.log('🔍 Fetching service with ID:', serviceId);

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      console.log('❌ Invalid service ID format:', serviceId);
      return res.status(400).json({ 
        success: false,
        error: 'Invalid service ID format. Service ID must be a valid ObjectId.' 
      });
    }

    const service = await Service.findOne({ _id: serviceId, status: 'active' })
      .populate({ path: 'category_id', select: 'display_name' })
      .populate({ path: 'provider_id', select: 'username verification_tier reputation_score created_at profile_data' })
      .lean();

    if (!service) {
      console.log('❌ Service not found:', serviceId);
      return res.status(404).json({ error: 'Service not found' });
    }

    console.log('✅ Service found:', service.title);

    // Parse profile data - handle both JSON string and object
    let profileData = {};
    try {
      if (typeof service.provider_id?.profile_data === 'string') {
        profileData = JSON.parse(service.provider_id.profile_data || '{}');
      } else if (typeof service.provider_id?.profile_data === 'object' && service.provider_id?.profile_data !== null) {
        profileData = service.provider_id.profile_data;
      }
    } catch (e) {
      console.error('Error parsing profile data:', e.message);
      profileData = {};
    }

    // Parse media_urls - handle both JSON string and array
    let mediaUrls = [];
    try {
      if (Array.isArray(service.media_urls)) {
        mediaUrls = service.media_urls;
      } else if (typeof service.media_urls === 'string') {
        mediaUrls = JSON.parse(service.media_urls || '[]');
      }
    } catch (e) {
      console.error('Error parsing media_urls:', e.message);
      mediaUrls = [];
    }

    // Parse requirements - handle both JSON string and array/object
    let requirements = [];
    try {
      if (Array.isArray(service.requirements)) {
        requirements = service.requirements;
      } else if (typeof service.requirements === 'string') {
        requirements = JSON.parse(service.requirements || '[]');
      } else if (typeof service.requirements === 'object' && service.requirements !== null) {
        requirements = service.requirements;
      }
    } catch (e) {
      console.error('Error parsing requirements:', e.message);
      requirements = [];
    }

    // Format response to match frontend expectations
    const formattedService = {
      id: service._id.toString(),
      title: service.title || 'Untitled Service',
      description: service.description || 'No description available',
      longDescription: service.description || '',
      price: parseFloat(service.price) || 0,
      duration: service.duration_minutes ? `${service.duration_minutes} minutes` : 'session',
      category: service.category_id?.display_name || 'General',
      subcategory: 'Standard',
      location: service.location_type || 'Location not specified',
      availableHours: 'Hours not specified',
      availableDays: [],
      photos: mediaUrls,
      tags: [],
      services: [],
      requirements: requirements,
      safety: [],
      available: service.status === 'active',
      rating: parseFloat(service.rating) || 0,
      reviews: parseInt(service.bookings) || 0,
      verificationTier: service.provider_id?.verification_tier || 'Basic',
      trustScore: parseInt(service.provider_id?.reputation_score) || 0,
      privacyLevel: 'standard',
      provider: {
        id: service.provider_id?._id?.toString() || null,
        name: profileData.firstName || profileData.username || service.provider_id?.username || 'Provider',
        age: profileData.age || 'N/A',
        height: profileData.height || 'N/A',
        bodyType: profileData.bodyType || 'N/A',
        languages: Array.isArray(profileData.languages) ? profileData.languages : [],
        responseTime: profileData.responseTime || '24 hours',
        memberSince: service.provider_id?.created_at ? new Date(service.provider_id.created_at).toLocaleDateString() : 'Recently',
        totalBookings: parseInt(service.bookings) || 0,
        completionRate: 95
      }
    };

    // Increment view count
    await Service.updateOne({ _id: serviceId }, { $inc: { views: 1 } });

    console.log('✅ Service formatted successfully');

    res.json({
      success: true,
      service: formattedService
    });

  } catch (error) {
    console.error('❌ Error fetching service:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get service'
    });
  }
});

/**
 * @route   POST /api/services
 * @desc    Create new service
 * @access  Private
 */
router.post('/', authMiddleware, requireSubscription(), async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      title, 
      description, 
      price, 
      duration_minutes, 
      category_id,
      location_type,
      location_data,
      availability,
      requirements,
      media_urls
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId) || (category_id && !mongoose.Types.ObjectId.isValid(category_id))) {
      return res.status(400).json({ error: 'Invalid user or category ID' });
    }

    // Validate required fields
    if (!title || !description || !price || !category_id) {
      return res.status(400).json({
        error: 'Missing required fields: title, description, price, category_id'
      });
    }

    // Create new service
    const newService = await Service.create({
      provider_id: new mongoose.Types.ObjectId(userId),
      category_id: new mongoose.Types.ObjectId(category_id),
      title,
      description,
      price: Number(price),
      duration_minutes: duration_minutes || 60,
      location_type: location_type || 'local',
      location_data: location_data || {},
      availability: availability || {},
      requirements: requirements || [],
      media_urls: media_urls || [],
      status: 'active'
    });

    const detailsResult = await Service.findById(newService._id)
      .populate({ path: 'category_id', select: 'display_name' })
      .populate({ path: 'provider_id', select: 'username verification_tier reputation_score' })
      .lean();

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      service: detailsResult
    });

  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({
      error: 'Failed to create service',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
