const express = require('express');
const request = require('supertest');

const IDS = {
  providerViewer: '507f1f77bcf86cd799439111',
  clientViewer: '507f1f77bcf86cd799439112',
  providerTarget: '507f1f77bcf86cd799439113',
  sugarVisibleTarget: '507f1f77bcf86cd799439114',
  sugarHiddenTarget: '507f1f77bcf86cd799439115'
};

let mockCurrentUserId = null;

const mockUserFindById = jest.fn();
const mockSugarAccessFindOne = jest.fn();

const buildAwaitableSelectChain = (doc) => {
  const query = {
    lean: jest.fn().mockResolvedValue(doc),
    then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
    catch: (reject) => Promise.resolve(doc).catch(reject)
  };

  return {
    select: jest.fn().mockReturnValue(query)
  };
};

const buildSelectLeanChain = (doc) => ({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(doc)
  })
});

jest.mock('../routes/auth', () => ({
  authMiddleware: (req, res, next) => {
    if (!mockCurrentUserId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    req.user = { userId: mockCurrentUserId };
    return next();
  },
  optionalAuthMiddleware: (req, res, next) => {
    if (mockCurrentUserId) {
      req.user = { userId: mockCurrentUserId };
    }
    next();
  }
}));

jest.mock('../services/MongoRecommendationEngine', () => {
  return jest.fn().mockImplementation(() => ({
    getAccountTypeAwareRecommendations: jest.fn(),
    trackActivity: jest.fn()
  }));
});

jest.mock('../config/database', () => ({
  User: {
    findById: (...args) => mockUserFindById(...args),
    find: jest.fn(),
    countDocuments: jest.fn(),
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
    create: jest.fn(),
    updateMany: jest.fn()
  },
  SugarAccessPayment: {
    findOne: (...args) => mockSugarAccessFindOne(...args)
  },
  isDatabaseAvailable: jest.fn(() => true)
}));

const usersRouter = require('../routes/users');

const baseProviderProfile = {
  _id: IDS.providerTarget,
  username: 'provider-target',
  accountType: 'provider',
  profileData: {
    firstName: 'Provider',
    location: { city: 'Accra', country: 'Ghana', coordinates: [0.1, 0.2] }
  },
  profileVisibility: 'public',
  verificationTier: 2,
  reputationScore: 74,
  createdAt: new Date('2025-01-15T00:00:00.000Z')
};

const baseSugarVisibleProfile = {
  _id: IDS.sugarVisibleTarget,
  username: 'sugar-visible-target',
  accountType: 'sugar_daddy',
  profileData: {
    firstName: 'Sugar Visible',
    sugarSettings: {
      visibleToProviders: true
    }
  },
  profileVisibility: 'public',
  verificationTier: 2,
  reputationScore: 88,
  createdAt: new Date('2025-01-15T00:00:00.000Z')
};

const baseSugarHiddenProfile = {
  _id: IDS.sugarHiddenTarget,
  username: 'sugar-hidden-target',
  accountType: 'sugar_daddy',
  profileData: {
    firstName: 'Sugar Hidden',
    sugarSettings: {
      visibleToProviders: false
    }
  },
  profileVisibility: 'public',
  verificationTier: 2,
  reputationScore: 86,
  createdAt: new Date('2025-01-15T00:00:00.000Z')
};

describe('Users Profile Access Matrix', () => {
  let app;
  let usersById;
  let paymentsByProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUserId = null;

    usersById = new Map();
    paymentsByProvider = new Map();

    usersById.set(IDS.providerViewer, {
      _id: IDS.providerViewer,
      username: 'viewer-provider',
      accountType: 'provider',
      profileData: { firstName: 'Viewer Provider' }
    });
    usersById.set(IDS.clientViewer, {
      _id: IDS.clientViewer,
      username: 'viewer-client',
      accountType: 'client',
      profileData: { firstName: 'Viewer Client' }
    });
    usersById.set(IDS.providerTarget, { ...baseProviderProfile });
    usersById.set(IDS.sugarVisibleTarget, { ...baseSugarVisibleProfile });
    usersById.set(IDS.sugarHiddenTarget, { ...baseSugarHiddenProfile });

    mockUserFindById.mockImplementation((id) => {
      const user = usersById.get(String(id)) || null;
      return buildAwaitableSelectChain(user);
    });

    mockSugarAccessFindOne.mockImplementation((query = {}) => {
      const providerKey = String(query.providerId || '');
      const requiredTypes = Array.isArray(query.accessType?.$in) ? query.accessType.$in : [];
      const minExpiry = query.accessExpiresAt?.$gt ? new Date(query.accessExpiresAt.$gt) : new Date(0);
      const providerPayments = paymentsByProvider.get(providerKey) || [];

      const payment = providerPayments.find((entry) => {
        const accessTypeAllowed = requiredTypes.length
          ? requiredTypes.includes(entry.accessType)
          : true;

        if (!accessTypeAllowed) {
          return false;
        }

        const expiresAt = new Date(entry.accessExpiresAt);
        if (Number.isNaN(expiresAt.getTime()) || expiresAt <= minExpiry) {
          return false;
        }

        return true;
      }) || null;

      return buildSelectLeanChain(payment);
    });

    app = express();
    app.use(express.json());
    app.use('/users', usersRouter);
  });

  test('allows public provider profile access when viewer is unauthenticated', async () => {
    const response = await request(app)
      .get(`/users/${IDS.providerTarget}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.accountType).toBe('provider');
  });

  test('blocks unauthenticated access to sugar profiles', async () => {
    const response = await request(app)
      .get(`/users/${IDS.sugarVisibleTarget}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.requiresAuth).toBe(true);
  });

  test('blocks authenticated client accounts from viewing sugar profiles', async () => {
    mockCurrentUserId = IDS.clientViewer;

    const response = await request(app)
      .get(`/users/${IDS.sugarVisibleTarget}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toMatch(/only provider accounts/i);
    expect(mockSugarAccessFindOne).not.toHaveBeenCalled();
  });

  test('blocks providers without active sugar access payment', async () => {
    mockCurrentUserId = IDS.providerViewer;

    const response = await request(app)
      .get(`/users/${IDS.sugarVisibleTarget}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.requiresPayment).toBe(true);
  });

  test('blocks paid providers when sugar profile is hidden', async () => {
    mockCurrentUserId = IDS.providerViewer;
    paymentsByProvider.set(IDS.providerViewer, [
      {
        _id: '507f1f77bcf86cd7994391a1',
        accessType: 'sugar_daddy',
        accessExpiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString()
      }
    ]);

    const response = await request(app)
      .get(`/users/${IDS.sugarHiddenTarget}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toMatch(/currently hidden/i);
    expect(mockSugarAccessFindOne).not.toHaveBeenCalled();
  });

  test('allows paid providers to view visible sugar profiles', async () => {
    mockCurrentUserId = IDS.providerViewer;
    paymentsByProvider.set(IDS.providerViewer, [
      {
        _id: '507f1f77bcf86cd7994391a2',
        accessType: 'sugar_daddy',
        accessExpiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString()
      }
    ]);

    const response = await request(app)
      .get(`/users/${IDS.sugarVisibleTarget}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.accountType).toBe('sugar_daddy');
  });
});