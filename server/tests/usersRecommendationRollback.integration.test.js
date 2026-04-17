const express = require('express');
const request = require('supertest');

const mockGetAccountTypeAwareRecommendations = jest.fn();
const mockUserFind = jest.fn();
const mockUserCountDocuments = jest.fn();

jest.mock('../routes/auth', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { userId: '507f1f77bcf86cd799439011' };
    next();
  },
  optionalAuthMiddleware: (req, res, next) => next()
}));

jest.mock('../services/MongoRecommendationEngine', () => {
  return jest.fn().mockImplementation(() => ({
    getAccountTypeAwareRecommendations: (...args) => mockGetAccountTypeAwareRecommendations(...args),
    trackActivity: jest.fn()
  }));
});

jest.mock('../config/database', () => ({
  User: {
    find: (...args) => mockUserFind(...args),
    countDocuments: (...args) => mockUserCountDocuments(...args),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn()
  },
  BlockedUser: {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn()
  },
  Conversation: {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn()
  },
  SugarAccessPayment: {
    findOne: jest.fn()
  },
  isDatabaseAvailable: jest.fn(() => true)
}));

const usersRouter = require('../routes/users');

function createFindChain(results) {
  return {
    select: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(results)
          })
        })
      })
    })
  };
}

describe('Users Route Recommendation Rollback', () => {
  let app;
  let runtimeFlagState;

  beforeEach(() => {
    jest.clearAllMocks();
    runtimeFlagState = {
      recommendationV2Enabled: true,
      recommendationRollbackEnabled: false,
      providerClientSurfaceDefaultEnabled: true,
      dynamicTrustFloorEnabled: true,
      rankingReasonsEnabled: true
    };

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.featureFlags = {
        isEnabled: (flagName, fallbackValue) => {
          if (Object.prototype.hasOwnProperty.call(runtimeFlagState, flagName)) {
            return runtimeFlagState[flagName];
          }
          return fallbackValue;
        }
      };
      next();
    });
    app.use('/users', usersRouter);
  });

  test('uses simple-sort fallback when rollback switch is active', async () => {
    runtimeFlagState.recommendationV2Enabled = false;
    runtimeFlagState.recommendationRollbackEnabled = true;

    mockUserFind.mockReturnValueOnce(createFindChain([
      {
        _id: '507f1f77bcf86cd799439021',
        username: 'fallback-provider',
        profile_data: {
          firstName: 'Fallback',
          location: { city: 'Accra', country: 'Ghana' },
          photos: ['https://img.test/profile.jpg']
        },
        verification_tier: 2,
        reputation_score: 70,
        is_subscribed: true,
        subscription_tier: 'premium',
        last_active: new Date().toISOString(),
        created_at: new Date().toISOString()
      }
    ]));
    mockUserCountDocuments.mockResolvedValueOnce(1);

    const response = await request(app)
      .get('/users/profiles')
      .query({ sort: 'recommendation', limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.metadata.recommendationRollbackActive).toBe(true);
    expect(response.body.metadata.algorithm).toBe('fallback_simple_sort_v1');
    expect(response.body.users).toHaveLength(1);
    expect(mockGetAccountTypeAwareRecommendations).not.toHaveBeenCalled();
  });

  test('uses recommendation engine when rollback switch is disabled', async () => {
    mockGetAccountTypeAwareRecommendations.mockResolvedValueOnce({
      profiles: [
        {
          _id: '507f1f77bcf86cd799439022',
          username: 'engine-provider',
          profile_data: {
            firstName: 'Engine',
            location: { city: 'Accra', country: 'Ghana' },
            photos: ['https://img.test/engine.jpg']
          },
          verification_tier: 3,
          reputation_score: 88,
          recommendationScore: 94.5,
          sameCountry: true,
          rankingReasons: [{ key: 'country_match', label: 'Same Country' }]
        }
      ],
      total: 1,
      metadata: {
        algorithm: 'uber_bolt_style_v1'
      }
    });

    const response = await request(app)
      .get('/users/profiles')
      .query({ sort: 'recommendation', limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.metadata.algorithm).toBe('uber_bolt_style_v1');
    expect(response.body.metadata.recommendationRollbackActive).toBe(false);
    expect(mockGetAccountTypeAwareRecommendations).toHaveBeenCalledTimes(1);
  });
});