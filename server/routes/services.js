const express = require('express');
const { authMiddleware } = require('./auth');
const { query, isDatabaseAvailable } = require('../config/database');
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

    const { category, location, minPrice, maxPrice, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE s.status = 'active'";
    const queryParams = [];
    let paramCount = 0;

    if (category) {
      paramCount++;
      whereClause += ` AND c.name = $${paramCount}`;
      queryParams.push(category);
    }

    if (minPrice) {
      paramCount++;
      whereClause += ` AND s.price >= $${paramCount}`;
      queryParams.push(parseFloat(minPrice));
    }

    if (maxPrice) {
      paramCount++;
      whereClause += ` AND s.price <= $${paramCount}`;
      queryParams.push(parseFloat(maxPrice));
    }

    paramCount++;
    queryParams.push(parseInt(limit));
    paramCount++;
    queryParams.push(offset);

    const servicesResult = await query(`
      SELECT 
        s.id, s.provider_id, s.title, s.description, s.price, s.duration_minutes,
        s.location_type, s.location_data, s.media_urls, s.views, 
        s.bookings, s.rating, s.created_at,
        c.display_name as category_name,
        u.username as provider_username,
        u.verification_tier, u.reputation_score
      FROM services s
      LEFT JOIN service_categories c ON s.category_id = c.id
      LEFT JOIN users u ON s.provider_id = u.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `, queryParams);

    res.json({
      services: servicesResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: servicesResult.rows.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get services error:', error);
    
    // Return mock data on database error
    if (error.message.includes('Connection') || error.message.includes('timeout') || error.message.includes('unavailable')) {
      return res.json({
        services: mockServices,
        pagination: { page: 1, limit: 20, hasMore: false },
        metadata: { mockData: true, message: 'Database temporarily unavailable' }
      });
    }
    
    res.status(500).json({
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
        categories: mockCategories,
        metadata: { mockData: true }
      });
    }

    const categoriesResult = await query(`
      SELECT id, name, display_name, description, base_price
      FROM service_categories
      ORDER BY display_name
    `);

    res.json({
      categories: categoriesResult.rows
    });

  } catch (error) {
    console.error('Get categories error:', error);
    
    // Return mock data on database error
    if (error.message.includes('Connection') || error.message.includes('timeout') || error.message.includes('unavailable')) {
      return res.json({
        categories: mockCategories,
        metadata: { mockData: true }
      });
    }
    
    res.status(500).json({ error: 'Failed to fetch categories' });
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
    
    const servicesResult = await query(`
      SELECT 
        s.id, s.title, s.description, s.price, s.duration_minutes,
        s.location_type, s.location_data, s.media_urls, s.views, 
        s.bookings, s.rating, s.status, s.created_at,
        c.display_name as category_name,
        u.username as provider_username,
        u.verification_tier, u.reputation_score
      FROM services s
      LEFT JOIN service_categories c ON s.category_id = c.id
      LEFT JOIN users u ON s.provider_id = u.id
      WHERE s.provider_id = $1
      ORDER BY s.created_at DESC
    `, [userId]);

    res.json({
      services: servicesResult.rows
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

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(serviceId)) {
      console.log('❌ Invalid service ID format:', serviceId);
      return res.status(400).json({ 
        success: false,
        error: 'Invalid service ID format. Service ID must be a valid UUID.' 
      });
    }

    const serviceResult = await query(`
      SELECT 
        s.*,
        c.display_name as category_name,
        u.username as provider_username,
        u.verification_tier, u.reputation_score, u.created_at as provider_joined,
        u.profile_data
      FROM services s
      LEFT JOIN service_categories c ON s.category_id = c.id
      LEFT JOIN users u ON s.provider_id = u.id
      WHERE s.id = $1 AND s.status = 'active'
    `, [serviceId]);

    if (serviceResult.rows.length === 0) {
      console.log('❌ Service not found:', serviceId);
      return res.status(404).json({ error: 'Service not found' });
    }

    const service = serviceResult.rows[0];
    console.log('✅ Service found:', service.title);

    // Parse profile data - handle both JSON string and object
    let profileData = {};
    try {
      if (typeof service.profile_data === 'string') {
        profileData = JSON.parse(service.profile_data || '{}');
      } else if (typeof service.profile_data === 'object' && service.profile_data !== null) {
        profileData = service.profile_data;
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
      id: service.id,
      title: service.title || 'Untitled Service',
      description: service.description || 'No description available',
      longDescription: service.description || '',
      price: parseFloat(service.price) || 0,
      duration: service.duration_minutes ? `${service.duration_minutes} minutes` : 'session',
      category: service.category_name || 'General',
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
      verificationTier: service.verification_tier || 'Basic',
      trustScore: parseInt(service.reputation_score) || 0,
      privacyLevel: 'standard',
      provider: {
        id: service.provider_id,
        name: profileData.firstName || profileData.username || service.provider_username || 'Provider',
        age: profileData.age || 'N/A',
        height: profileData.height || 'N/A',
        bodyType: profileData.bodyType || 'N/A',
        languages: Array.isArray(profileData.languages) ? profileData.languages : [],
        responseTime: profileData.responseTime || '24 hours',
        memberSince: service.provider_joined ? new Date(service.provider_joined).toLocaleDateString() : 'Recently',
        totalBookings: parseInt(service.bookings) || 0,
        completionRate: 95
      }
    };

    // Increment view count
    await query(
      'UPDATE services SET views = views + 1 WHERE id = $1',
      [serviceId]
    );

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
router.post('/', authMiddleware, async (req, res) => {
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

    // Validate required fields
    if (!title || !description || !price || !category_id) {
      return res.status(400).json({
        error: 'Missing required fields: title, description, price, category_id'
      });
    }

    // Create new service
    const serviceResult = await query(`
      INSERT INTO services (
        provider_id, category_id, title, description, price, 
        duration_minutes, location_type, location_data, 
        availability, requirements, media_urls, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')
      RETURNING *
    `, [
      userId, category_id, title, description, price,
      duration_minutes || null, location_type || 'local',
      JSON.stringify(location_data || {}),
      JSON.stringify(availability || {}),
      JSON.stringify(requirements || []),
      JSON.stringify(media_urls || [])
    ]);

    const newService = serviceResult.rows[0];

    // Get category and user info for response
    const detailsResult = await query(`
      SELECT 
        s.*,
        c.display_name as category_name,
        u.username as provider_username,
        u.verification_tier,
        u.reputation_score
      FROM services s
      LEFT JOIN service_categories c ON s.category_id = c.id
      LEFT JOIN users u ON s.provider_id = u.id
      WHERE s.id = $1
    `, [newService.id]);

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      service: detailsResult.rows[0]
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
