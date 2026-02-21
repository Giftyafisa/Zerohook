/**
 * Subscription Check Middleware
 * 
 * Server-side enforcement of subscription requirements.
 * Prevents bypassing the frontend paywall via direct API calls.
 * 
 * Usage:
 *   router.get('/premium-feature', authMiddleware, requireSubscription, handler);
 *   router.get('/premium-feature', authMiddleware, requireSubscription('premium'), handler); // specific tier
 */

const { User } = require('../config/database');

/**
 * Middleware factory that checks if the authenticated user has an active subscription.
 * Can be called with no arguments (any active sub) or with a tier name.
 * 
 * @param {string} [requiredTier] - Optional minimum tier ('premium', 'vvip', etc.)
 * @returns {Function} Express middleware
 */
function requireSubscription(requiredTier) {
  // If called as middleware directly (not as factory), handle both patterns
  if (typeof requiredTier === 'object' && requiredTier.user) {
    // Called as requireSubscription (without parentheses) — req is the first argument
    return _check(null, requiredTier, arguments[1], arguments[2]);
  }

  // Called as requireSubscription() or requireSubscription('premium')
  return function (req, res, next) {
    return _check(requiredTier || null, req, res, next);
  };
}

async function _check(requiredTier, req, res, next) {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Use data already attached by authMiddleware (which now checks expiry)
    let isSubscribed = req.user.is_subscribed;
    let subTier = req.user.subscription_tier;
    const expiresAt = req.user.subscription_expires_at;

    // Double-check expiry (belt + suspenders)
    if (isSubscribed && expiresAt && new Date(expiresAt) <= new Date()) {
      isSubscribed = false;
      subTier = 'free';
      // Fire-and-forget DB update
      User.findByIdAndUpdate(req.user.userId, {
        is_subscribed: false,
        subscription_tier: 'free'
      }).catch(e => console.error('Subscription expiry cleanup error:', e));
    }

    if (!isSubscribed) {
      return res.status(403).json({
        success: false,
        error: 'Active subscription required',
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Please subscribe to access this feature'
      });
    }

    // Check specific tier if required
    if (requiredTier) {
      const tierHierarchy = { 'free': 0, 'basic': 1, 'premium': 2, 'vvip': 3 };
      const userTierLevel = tierHierarchy[subTier] || 0;
      const requiredTierLevel = tierHierarchy[requiredTier] || 0;

      if (userTierLevel < requiredTierLevel) {
        return res.status(403).json({
          success: false,
          error: `${requiredTier} subscription required`,
          code: 'INSUFFICIENT_TIER',
          currentTier: subTier,
          requiredTier: requiredTier
        });
      }
    }

    next();
  } catch (error) {
    console.error('Subscription check middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Subscription verification failed'
    });
  }
}

module.exports = requireSubscription;
