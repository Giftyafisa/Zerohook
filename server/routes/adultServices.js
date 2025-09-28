const express = require('express');
const { authMiddleware } = require('./auth');
const AdultServiceManager = require('../services/AdultServiceManager');
const PrivacyManager = require('../services/PrivacyManager');
const router = express.Router();

const adultServiceManager = new AdultServiceManager();
const privacyManager = new PrivacyManager();

/**
 * @route   GET /api/adult-services/categories
 * @desc    Get all adult service categories
 * @access  Public
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = adultServiceManager.getServiceCategories();
    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

/**
 * @route   GET /api/adult-services
 * @desc    Get adult service listings with filters and privacy controls
 * @access  Public (with privacy filtering)
 */
router.get('/', async (req, res) => {
  try {
    const { 
      category, 
      location, 
      minPrice, 
      maxPrice, 
      verificationTier,
      minTrustScore,
      page = 1, 
      limit = 20 
    } = req.query;

    const filters = {
      category,
      location,
      minPrice: minPrice ? parseFloat(minPrice) : null,
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      verificationTier: verificationTier ? parseInt(verificationTier) : null,
      minTrustScore: minTrustScore ? parseInt(minTrustScore) : null,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    };

    const services = await adultServiceManager.getServiceListings(filters);
    
    // Apply privacy filtering to each service
    const filteredServices = await Promise.all(
      services.map(async (service) => {
        try {
          const visibleData = await privacyManager.getVisibleProfileData(service.user_id);
          return {
            ...service,
            provider: visibleData
          };
        } catch (error) {
          console.error('Privacy filtering error for service:', service.id, error);
          // Return minimal data if privacy filtering fails
          return {
            ...service,
            provider: {
              username: service.username,
              verification_tier: service.verification_tier,
              trust_score_range: privacyManager.getTrustScoreRange(service.trust_score),
              is_verified: service.is_verified
            }
          };
        }
      })
    );

    res.json({
      services: filteredServices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: filteredServices.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get adult services error:', error);
    res.status(500).json({ error: 'Failed to get adult services' });
  }
});

/**
 * @route   GET /api/adult-services/:id
 * @desc    Get adult service by ID with privacy controls
 * @access  Public (with privacy filtering)
 */
router.get('/:id', async (req, res) => {
  try {
    const serviceId = req.params.id;
    const service = await adultServiceManager.getServiceById(serviceId);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Apply privacy filtering to provider data
    const visibleProviderData = await privacyManager.getVisibleProfileData(service.user_id);

    const serviceWithPrivacy = {
      ...service,
      provider: visibleProviderData
    };

    res.json({ service: serviceWithPrivacy });

  } catch (error) {
    console.error('Get adult service error:', error);
    res.status(500).json({ error: 'Failed to get adult service' });
  }
});

/**
 * @route   POST /api/adult-services
 * @desc    Create new adult service listing
 * @access  Private (requires authentication and verification tier 2+)
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if user has required verification tier
    if (req.user.verification_tier < 2) {
      return res.status(403).json({ 
        error: 'Advanced verification required to create service listings',
        required_tier: 2,
        current_tier: req.user.verification_tier
      });
    }

    const serviceData = {
      category: req.body.category,
      title: req.body.title,
      description: req.body.description,
      price: parseFloat(req.body.price),
      duration: req.body.duration,
      location: req.body.location,
      availability: req.body.availability,
      photos: req.body.photos || [],
      specialRequirements: req.body.specialRequirements,
      privacyLevel: req.body.privacyLevel || 'standard'
    };

    // Validate required fields
    if (!serviceData.category || !serviceData.title || !serviceData.price) {
      return res.status(400).json({ error: 'Category, title, and price are required' });
    }

    // Validate category
    const validCategories = adultServiceManager.getServiceCategories().map(c => c.id);
    if (!validCategories.includes(serviceData.category)) {
      return res.status(400).json({ error: 'Invalid service category' });
    }

    // Validate price range for category
    const category = adultServiceManager.getServiceCategories().find(c => c.id === serviceData.category);
    if (serviceData.price < category.startingPrice || serviceData.price > category.maxPrice) {
      return res.status(400).json({ 
        error: `Price must be between $${category.startingPrice} and $${category.maxPrice} for ${category.name} services` 
      });
    }

    const newService = await adultServiceManager.createServiceListing(userId, serviceData);
    
    res.status(201).json({ 
      service: newService,
      message: 'Adult service listing created successfully' 
    });

  } catch (error) {
    console.error('Create adult service error:', error);
    res.status(500).json({ error: 'Failed to create adult service listing' });
  }
});

/**
 * @route   PUT /api/adult-services/:id
 * @desc    Update adult service listing
 * @access  Private (owner only)
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const serviceId = req.params.id;
    const userId = req.user.id;

    const updateData = {
      title: req.body.title,
      description: req.body.description,
      price: req.body.price ? parseFloat(req.body.price) : undefined,
      duration: req.body.duration,
      location: req.body.location,
      availability: req.body.availability,
      photos: req.body.photos,
      specialRequirements: req.body.specialRequirements,
      privacyLevel: req.body.privacyLevel
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updatedService = await adultServiceManager.updateServiceListing(
      serviceId, 
      userId, 
      updateData
    );

    if (!updatedService) {
      return res.status(404).json({ error: 'Service not found or access denied' });
    }

    res.json({ 
      service: updatedService,
      message: 'Adult service listing updated successfully' 
    });

  } catch (error) {
    console.error('Update adult service error:', error);
    res.status(500).json({ error: 'Failed to update adult service listing' });
  }
});

/**
 * @route   DELETE /api/adult-services/:id
 * @desc    Delete adult service listing
 * @access  Private (owner only)
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const serviceId = req.params.id;
    const userId = req.user.id;

    const deletedService = await adultServiceManager.deleteServiceListing(serviceId, userId);

    if (!deletedService) {
      return res.status(404).json({ error: 'Service not found or access denied' });
    }

    res.json({ 
      message: 'Adult service listing deleted successfully',
      service: deletedService
    });

  } catch (error) {
    console.error('Delete adult service error:', error);
    res.status(500).json({ error: 'Failed to delete adult service listing' });
  }
});

/**
 * @route   GET /api/adult-services/user/:userId
 * @desc    Get user's adult service listings
 * @access  Private (owner or verified users)
 */
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const requestingUserId = req.user.id;

    // Check if requesting user can view target user's services
    if (targetUserId !== requestingUserId.toString() && req.user.verification_tier < 2) {
      return res.status(403).json({ 
        error: 'Advanced verification required to view other users\' services' 
      });
    }

    const userServices = await adultServiceManager.getUserServices(targetUserId);
    
    res.json({ services: userServices });

  } catch (error) {
    console.error('Get user services error:', error);
    res.status(500).json({ error: 'Failed to get user services' });
  }
});

/**
 * @route   GET /api/adult-services/search/:term
 * @desc    Search adult services
 * @access  Public (with privacy filtering)
 */
router.get('/search/:term', async (req, res) => {
  try {
    const searchTerm = req.params.term;
    const { category, minPrice, maxPrice } = req.query;

    const filters = {
      category,
      minPrice: minPrice ? parseFloat(minPrice) : null,
      maxPrice: maxPrice ? parseFloat(maxPrice) : null
    };

    const searchResults = await adultServiceManager.searchServices(searchTerm, filters);
    
    // Apply privacy filtering to search results
    const filteredResults = await Promise.all(
      searchResults.map(async (service) => {
        try {
          const visibleData = await privacyManager.getVisibleProfileData(service.user_id);
          return {
            ...service,
            provider: visibleData
          };
        } catch (error) {
          console.error('Privacy filtering error for search result:', service.id, error);
          return {
            ...service,
            provider: {
              username: service.username,
              verification_tier: service.verification_tier,
              trust_score_range: privacyManager.getTrustScoreRange(service.trust_score),
              is_verified: service.is_verified
            }
          };
        }
      })
    );

    res.json({ 
      searchResults: filteredResults,
      searchTerm,
      totalResults: filteredResults.length
    });

  } catch (error) {
    console.error('Search adult services error:', error);
    res.status(500).json({ error: 'Failed to search adult services' });
  }
});

/**
 * @route   GET /api/adult-services/stats
 * @desc    Get adult service statistics
 * @access  Public
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await adultServiceManager.getServiceStats();
    const categories = adultServiceManager.getServiceCategories();
    
    res.json({ 
      stats,
      categories,
      totalCategories: categories.length
    });

  } catch (error) {
    console.error('Get adult service stats error:', error);
    res.status(500).json({ error: 'Failed to get adult service statistics' });
  }
});

module.exports = router;
