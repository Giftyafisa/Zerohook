const express = require('express');
const request = require('supertest');

const TEST_USER_ID = '507f1f77bcf86cd799439011';

const mockUserFindById = jest.fn();

jest.mock('../routes/auth', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { userId: TEST_USER_ID, verification_tier: 3 };
    next();
  }
}));

jest.mock('../config/database', () => ({
  User: {
    findById: (...args) => mockUserFindById(...args)
  },
  TrustEvent: {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([])
    })
  },
  FraudLog: {
    create: jest.fn()
  },
  Transaction: {
    aggregate: jest.fn().mockResolvedValue([])
  }
}));

const trustRouter = require('../routes/trust');

describe('Trust score scale smoke', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.trustEngine = {
        calculateTrustScore: jest.fn().mockResolvedValue({
          score: 760,
          components: {
            response_time: 0.8,
            transaction_success: 0.9
          },
          tier: 'High'
        })
      };
      next();
    });
    app.use('/trust', trustRouter);

    mockUserFindById.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        _id: TEST_USER_ID,
        username: 'trust-user',
        verification_tier: 3,
        reputation_score: 88,
        trust_score: 760,
        status: 'active'
      })
    }));
  });

  test('GET /trust/score normalizes engine score to 0-100 and exposes canonical scale', async () => {
    const response = await request(app).get('/trust/score');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.score).toBe(76);
    expect(response.body.responseRate).toBe(80);
    expect(response.body.completionRate).toBe(90);
    expect(response.body.trustScore).toEqual(
      expect.objectContaining({
        score: 76,
        scale: '0-100'
      })
    );
  });

  test('GET /trust/score/:userId returns normalized detailed trust score payload', async () => {
    const response = await request(app).get(`/trust/score/${TEST_USER_ID}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.trustScore).toEqual(
      expect.objectContaining({
        score: 76,
        scale: '0-100'
      })
    );
  });
});
