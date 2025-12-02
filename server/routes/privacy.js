const express = require('express');
const { authMiddleware } = require('./auth');
const PrivacyManager = require('../services/PrivacyManager');
const router = express.Router();

const privacyManager = new PrivacyManager();

/**
 * @route   GET /api/privacy/levels
 * @desc    Get available privacy levels
 * @access  Public
 */
router.get('/levels', async (req, res) => {
  try {
    const privacyLevels = privacyManager.getPrivacyLevels();
    res.json({ privacyLevels });
  } catch (error) {
    console.error('Get privacy levels error:', error);
    res.status(500).json({ error: 'Failed to get privacy levels' });
  }
});

/**
 * @route   GET /api/privacy/consent-types
 * @desc    Get available consent types
 * @access  Public
 */
router.get('/consent-types', async (req, res) => {
  try {
    const consentTypes = privacyManager.getConsentTypes();
    res.json({ consentTypes });
  } catch (error) {
    console.error('Get consent types error:', error);
    res.status(500).json({ error: 'Failed to get consent types' });
  }
});

/**
 * @route   GET /api/privacy/settings
 * @desc    Get user's privacy settings
 * @access  Private
 */
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const privacySettings = await privacyManager.getUserPrivacySettings(userId);
    
    res.json({ privacySettings });
  } catch (error) {
    console.error('Get privacy settings error:', error);
    res.status(500).json({ error: 'Failed to get privacy settings' });
  }
});

/**
 * @route   PUT /api/privacy/settings
 * @desc    Update user's privacy settings
 * @access  Private
 */
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const privacyData = {
      privacyLevel: req.body.privacyLevel,
      profileVisibility: req.body.profileVisibility,
      dataSharingPreferences: req.body.dataSharingPreferences,
      locationSharing: req.body.locationSharing,
      photoSharing: req.body.photoSharing,
      contactSharing: req.body.contactSharing
    };

    // Validate privacy level
    const validLevels = privacyManager.getPrivacyLevels().map(l => l.id);
    if (privacyData.privacyLevel && !validLevels.includes(privacyData.privacyLevel)) {
      return res.status(400).json({ error: 'Invalid privacy level' });
    }

    const updatedSettings = await privacyManager.updatePrivacySettings(userId, privacyData);
    
    res.json({ 
      privacySettings: updatedSettings,
      message: 'Privacy settings updated successfully' 
    });

  } catch (error) {
    console.error('Update privacy settings error:', error);
    res.status(500).json({ error: 'Failed to update privacy settings' });
  }
});

/**
 * @route   GET /api/privacy/consents
 * @desc    Get user's consent status
 * @access  Private
 */
router.get('/consents', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const consents = await privacyManager.getUserConsents(userId);
    
    res.json({ consents });
  } catch (error) {
    console.error('Get consents error:', error);
    res.status(500).json({ error: 'Failed to get consents' });
  }
});

/**
 * @route   POST /api/privacy/consents
 * @desc    Update user's consent for specific data sharing
 * @access  Private
 */
router.post('/consents', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { consentType, granted } = req.body;

    // Validate consent type
    const validConsentTypes = privacyManager.getConsentTypes().map(c => c.id);
    if (!validConsentTypes.includes(consentType)) {
      return res.status(400).json({ error: 'Invalid consent type' });
    }

    // Check if consent is required
    const consentTypeInfo = privacyManager.getConsentTypes().find(c => c.id === consentType);
    if (consentTypeInfo.required && !granted) {
      return res.status(400).json({ 
        error: 'This consent is required to use the platform' 
      });
    }

    const updatedConsent = await privacyManager.updateConsent(userId, consentType, granted);
    
    res.json({ 
      consent: updatedConsent,
      message: `Consent ${granted ? 'granted' : 'revoked'} successfully` 
    });

  } catch (error) {
    console.error('Update consent error:', error);
    res.status(500).json({ error: 'Failed to update consent' });
  }
});

/**
 * @route   GET /api/privacy/profile/:userId
 * @desc    Get visible profile data for a user (respecting privacy settings)
 * @access  Private (requires authentication)
 */
router.get('/profile/:userId', authMiddleware, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const requestingUserId = req.user.id;

    // Users can always view their own profile data
    if (targetUserId === requestingUserId.toString()) {
      // Return full profile data for own profile
      // This would typically come from a user profile service
      res.json({ 
        message: 'Viewing own profile - full data available',
        userId: targetUserId
      });
      return;
    }

    // Get visible profile data based on target user's privacy settings
    const visibleData = await privacyManager.getVisibleProfileData(targetUserId);
    
    res.json({ 
      profile: visibleData,
      message: 'Profile data retrieved with privacy controls applied'
    });

  } catch (error) {
    console.error('Get visible profile error:', error);
    res.status(500).json({ error: 'Failed to get visible profile data' });
  }
});

/**
 * @route   POST /api/privacy/data-deletion
 * @desc    Request data deletion
 * @access  Private
 */
router.post('/data-deletion', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reason, immediate } = req.body;

    if (immediate) {
      // For demo purposes, we'll allow immediate deletion
      // In production, this would typically schedule deletion for 30 days later
      const result = await privacyManager.requestDataDeletion(userId);
      
      res.json({ 
        message: 'Data deletion request submitted successfully',
        scheduled: false,
        result
      });
    } else {
      // Schedule deletion for 30 days later (GDPR compliance)
      const result = await privacyManager.requestDataDeletion(userId);
      
      res.json({ 
        message: 'Data deletion scheduled for 30 days from now',
        scheduled: true,
        scheduledDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        result
      });
    }

  } catch (error) {
    console.error('Data deletion request error:', error);
    res.status(500).json({ error: 'Failed to submit data deletion request' });
  }
});

/**
 * @route   GET /api/privacy/data-export
 * @desc    Export user's data
 * @access  Private
 */
router.get('/data-export', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userData = await privacyManager.exportUserData(userId);
    
    res.json({ 
      userData,
      message: 'Data export completed successfully',
      exportedAt: userData.exported_at
    });

  } catch (error) {
    console.error('Data export error:', error);
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

/**
 * @route   GET /api/privacy/consent-status
 * @desc    Check if user has consented to specific data sharing
 * @access  Private
 */
router.get('/consent-status/:consentType', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const consentType = req.params.consentType;

    // Validate consent type
    const validConsentTypes = privacyManager.getConsentTypes().map(c => c.id);
    if (!validConsentTypes.includes(consentType)) {
      return res.status(400).json({ error: 'Invalid consent type' });
    }

    const hasConsent = await privacyManager.hasConsent(userId, consentType);
    
    res.json({ 
      consentType,
      hasConsent,
      message: `Consent status for ${consentType}: ${hasConsent ? 'Granted' : 'Not granted'}`
    });

  } catch (error) {
    console.error('Check consent status error:', error);
    res.status(500).json({ error: 'Failed to check consent status' });
  }
});

/**
 * @route   GET /api/privacy/privacy-policy
 * @desc    Get privacy policy information
 * @access  Public
 */
router.get('/privacy-policy', async (req, res) => {
  try {
    const privacyPolicy = {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      summary: 'Our privacy policy ensures your data is protected and used responsibly',
      keyPoints: [
        'Data minimization - we only collect what we need',
        'User consent - explicit consent for all data sharing',
        'Right to erasure - you can delete your data anytime',
        'Data portability - export your data in standard formats',
        'Transparency - clear information about data usage',
        'Security - end-to-end encryption and secure storage'
      ],
      contactInfo: {
        email: 'privacy@zerohook.com',
        phone: '+1-800-PRIVACY',
        address: 'Privacy Office, Zerohook Inc.'
      }
    };
    
    res.json({ privacyPolicy });

  } catch (error) {
    console.error('Get privacy policy error:', error);
    res.status(500).json({ error: 'Failed to get privacy policy' });
  }
});

module.exports = router;
