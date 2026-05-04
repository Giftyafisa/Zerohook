const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef';

const TEST_USER_ID = '507f1f77bcf86cd799439011';

const mockUserFindById = jest.fn();
const mockUserSessionFind = jest.fn();
const mockUserSessionCountDocuments = jest.fn();

jest.mock('../config/database', () => ({
  User: {
    findById: (...args) => mockUserFindById(...args),
    countDocuments: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateMany: jest.fn()
  },
  FraudLog: {},
  RefreshToken: {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn()
  },
  UserSession: {
    find: (...args) => mockUserSessionFind(...args),
    countDocuments: (...args) => mockUserSessionCountDocuments(...args),
    updateMany: jest.fn()
  }
}));

const { router: authRouter } = require('../routes/auth');

describe('Auth login-history smoke', () => {
  let app;
  let token;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/auth', authRouter);

    token = jwt.sign(
      {
        userId: TEST_USER_ID,
        username: 'smoke-user',
        verificationTier: 2
      },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    mockUserFindById.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        _id: TEST_USER_ID,
        username: 'smoke-user',
        verification_tier: 2,
        status: 'active',
        is_subscribed: false,
        subscription_tier: 'free',
        subscription_expires_at: null,
        profile_data: {}
      })
    }));

    mockUserSessionFind.mockImplementation(() => ({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: '507f1f77bcf86cd799439099',
          sessionToken: 'abcdef1234567890',
          socketId: 'socket-1',
          ipAddress: '127.0.0.1',
          userAgent: 'jest-agent',
          isActive: true,
          createdAt: new Date('2026-04-17T08:00:00.000Z'),
          lastActivity: new Date('2026-04-17T08:05:00.000Z'),
          disconnectedAt: null,
          expiresAt: new Date('2026-04-17T09:00:00.000Z'),
          updatedAt: new Date('2026-04-17T08:05:00.000Z')
        }
      ])
    }));

    mockUserSessionCountDocuments.mockResolvedValue(1);
  });

  test('returns session-level login history payload for authenticated user', async () => {
    const response = await request(app)
      .get('/auth/login-history?page=1&limit=20')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(Array.isArray(response.body.data.sessions)).toBe(true);
    expect(response.body.data.sessions[0]).toEqual(
      expect.objectContaining({
        id: '507f1f77bcf86cd799439099',
        sessionTokenPreview: 'abcdef12...',
        ipAddress: '127.0.0.1',
        isActive: true
      })
    );
    expect(response.body.data.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 20,
        totalCount: 1,
        totalPages: 1,
        hasMore: false
      })
    );
  });
});
