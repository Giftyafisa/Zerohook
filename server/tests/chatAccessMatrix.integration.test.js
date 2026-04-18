const express = require('express');
const request = require('supertest');

const IDS = {
  clientA: '507f1f77bcf86cd799439011',
  clientB: '507f1f77bcf86cd799439012',
  provider: '507f1f77bcf86cd799439013',
  sugarDaddy: '507f1f77bcf86cd799439014'
};

let mockCurrentUserId = IDS.clientA;

const mockConversationFindOne = jest.fn();
const mockConversationFindOneAndUpdate = jest.fn();
const mockConversationFindByIdAndUpdate = jest.fn();
const mockUserFindById = jest.fn();
const mockSugarAccessFindOne = jest.fn();

const buildSelectLeanChain = (doc) => ({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(doc)
  })
});

jest.mock('../routes/auth', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { userId: mockCurrentUserId, username: 'tester' };
    next();
  }
}));

jest.mock('../utils/rateLimiters', () => ({
  createDistributedLimiter: () => ({
    consume: jest.fn().mockResolvedValue(undefined)
  })
}));

jest.mock('../config/database', () => ({
  Message: {},
  Conversation: {
    findOne: (...args) => mockConversationFindOne(...args),
    findOneAndUpdate: (...args) => mockConversationFindOneAndUpdate(...args),
    findByIdAndUpdate: (...args) => mockConversationFindByIdAndUpdate(...args)
  },
  User: {
    findById: (...args) => mockUserFindById(...args)
  },
  SugarAccessPayment: {
    findOne: (...args) => mockSugarAccessFindOne(...args)
  },
  isDatabaseAvailable: jest.fn(() => true)
}));

const chatRoutesModule = require('../routes/chat');
const chatRouter = chatRoutesModule.router || chatRoutesModule;

describe('Chat Route Access Matrix', () => {
  let app;
  let usersById;

  beforeEach(() => {
    jest.clearAllMocks();

    usersById = new Map();
    mockUserFindById.mockImplementation((id) => {
      const user = usersById.get(String(id)) || null;
      return buildSelectLeanChain(user);
    });

    mockSugarAccessFindOne.mockImplementation(() => buildSelectLeanChain(null));
    mockConversationFindOne.mockResolvedValue(null);
    mockConversationFindOneAndUpdate.mockResolvedValue({
      _id: '507f1f77bcf86cd799439099',
      createdAt: new Date(),
      participant1Id: IDS.clientA,
      participant2Id: IDS.provider
    });

    app = express();
    app.use(express.json());
    app.use('/chat', chatRouter);
  });

  test('blocks client-to-client conversation start', async () => {
    mockCurrentUserId = IDS.clientA;
    usersById.set(IDS.clientA, { _id: IDS.clientA, accountType: 'client' });
    usersById.set(IDS.clientB, { _id: IDS.clientB, accountType: 'client' });

    const response = await request(app)
      .post('/chat/start')
      .send({ otherUserId: IDS.clientB });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toMatch(/account type pair/i);
    expect(mockConversationFindOneAndUpdate).not.toHaveBeenCalled();
  });

  test('requires paid sugar access for provider to message sugar profiles', async () => {
    mockCurrentUserId = IDS.provider;
    usersById.set(IDS.provider, { _id: IDS.provider, accountType: 'provider' });
    usersById.set(IDS.sugarDaddy, { _id: IDS.sugarDaddy, accountType: 'sugar_daddy' });

    const response = await request(app)
      .post('/chat/start')
      .send({ otherUserId: IDS.sugarDaddy });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.requiresPayment).toBe(true);
    expect(response.body.requiredAccessType).toBe('sugar_daddy');
    expect(mockConversationFindOneAndUpdate).not.toHaveBeenCalled();
  });

  test('requires paid sugar access for client to message sugar profiles', async () => {
    mockCurrentUserId = IDS.clientA;
    usersById.set(IDS.clientA, { _id: IDS.clientA, accountType: 'client' });
    usersById.set(IDS.sugarDaddy, { _id: IDS.sugarDaddy, accountType: 'sugar_daddy' });

    const response = await request(app)
      .post('/chat/start')
      .send({ otherUserId: IDS.sugarDaddy });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.requiresPayment).toBe(true);
    expect(response.body.requiredAccessType).toBe('sugar_daddy');
    expect(mockConversationFindOneAndUpdate).not.toHaveBeenCalled();
  });

  test('allows provider to start sugar conversation when active sugar payment exists', async () => {
    mockCurrentUserId = IDS.provider;
    usersById.set(IDS.provider, { _id: IDS.provider, accountType: 'provider' });
    usersById.set(IDS.sugarDaddy, { _id: IDS.sugarDaddy, accountType: 'sugar_daddy' });
    mockSugarAccessFindOne.mockImplementation(() => buildSelectLeanChain({ _id: 'pay_1' }));

    const response = await request(app)
      .post('/chat/start')
      .send({ otherUserId: IDS.sugarDaddy });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.conversationId).toBeTruthy();
  });

  test('allows client to start sugar conversation when active sugar payment exists', async () => {
    mockCurrentUserId = IDS.clientA;
    usersById.set(IDS.clientA, { _id: IDS.clientA, accountType: 'client' });
    usersById.set(IDS.sugarDaddy, { _id: IDS.sugarDaddy, accountType: 'sugar_daddy' });
    mockSugarAccessFindOne.mockImplementation(() => buildSelectLeanChain({ _id: 'pay_2' }));

    const response = await request(app)
      .post('/chat/start')
      .send({ otherUserId: IDS.sugarDaddy });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.conversationId).toBeTruthy();
  });
});
