const express = require('express');
const request = require('supertest');
const RuntimeFeatureFlags = require('../services/RuntimeFeatureFlags');

const mockCountDocuments = jest.fn();

jest.mock('../routes/auth', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { userId: '507f1f77bcf86cd799439011', verification_tier: 4 };
    next();
  }
}));

jest.mock('../config/database', () => ({
  User: { countDocuments: (...args) => mockCountDocuments(...args) },
  Service: { countDocuments: (...args) => mockCountDocuments(...args) },
  AdultService: { countDocuments: (...args) => mockCountDocuments(...args) },
  Transaction: { countDocuments: (...args) => mockCountDocuments(...args) }
}));

const statusRouter = require('../routes/status');

describe('Status Route Runtime Feature Flags', () => {
  let app;
  let featureFlags;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCountDocuments.mockResolvedValue(0);
    featureFlags = new RuntimeFeatureFlags();

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.featureFlags = featureFlags;
      req.userActivityMonitor = {
        getOnlineUsersCount: jest.fn().mockResolvedValue(0),
        getUserPresence: jest.fn().mockResolvedValue({ isOnline: false }),
        getSystemActivityOverview: jest.fn().mockResolvedValue({})
      };
      req.performanceMetrics = {
        getPerformanceSummary: jest.fn().mockResolvedValue({}),
        getSystemHealthScore: jest.fn().mockResolvedValue(100),
        getEndpointPerformance: jest.fn().mockResolvedValue({}),
        getSlowQueries: jest.fn().mockResolvedValue([])
      };
      req.systemHealth = {
        getDetailedStatus: jest.fn().mockResolvedValue({ status: 'ok' })
      };
      next();
    });
    app.use('/status', statusRouter);
  });

  test('returns runtime feature flag snapshot', async () => {
    const response = await request(app).get('/status/feature-flags');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.flags.recommendationV2Enabled.enabled).toBe(true);
    expect(response.body.data.flags.recommendationRollbackEnabled.enabled).toBe(false);
  });

  test('updates a single runtime feature flag', async () => {
    const response = await request(app)
      .put('/status/feature-flags/recommendationV2Enabled')
      .send({ enabled: false });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.updated.name).toBe('recommendationV2Enabled');
    expect(response.body.data.updated.enabled).toBe(false);
    expect(featureFlags.isEnabled('recommendationV2Enabled', true)).toBe(false);
  });

  test('toggles recommendation rollback preset', async () => {
    const response = await request(app)
      .post('/status/rollback/recommendation')
      .send({ enabled: true });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.rollback.rollbackEnabled).toBe(true);
    expect(response.body.data.rollback.recommendationV2Enabled).toBe(false);
    expect(featureFlags.isEnabled('recommendationRollbackEnabled', false)).toBe(true);
    expect(featureFlags.isEnabled('recommendationV2Enabled', true)).toBe(false);
  });
});