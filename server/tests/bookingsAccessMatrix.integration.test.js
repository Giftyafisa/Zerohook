const express = require('express');
const request = require('supertest');

const IDS = {
  client: '507f1f77bcf86cd799439021',
  provider: '507f1f77bcf86cd799439022',
  otherClient: '507f1f77bcf86cd799439023'
};

let mockCurrentUserId = IDS.client;

const mockUserFindById = jest.fn();
const mockTransactionCreate = jest.fn();

const buildSelectLeanChain = (doc) => ({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(doc)
  })
});

jest.mock('../routes/auth', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { userId: mockCurrentUserId };
    next();
  }
}));

jest.mock('../config/database', () => ({
  User: {
    findById: (...args) => mockUserFindById(...args)
  },
  Transaction: {
    create: (...args) => mockTransactionCreate(...args),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findOne: jest.fn()
  }
}));

const bookingsRouter = require('../routes/bookings');

describe('Bookings Route Access Matrix', () => {
  let app;
  let usersById;

  beforeEach(() => {
    jest.clearAllMocks();
    usersById = new Map();

    mockUserFindById.mockImplementation((id) => {
      const user = usersById.get(String(id)) || null;
      return buildSelectLeanChain(user);
    });

    mockTransactionCreate.mockResolvedValue({
      _id: '507f1f77bcf86cd7994390aa'
    });

    app = express();
    app.use(express.json());
    app.use('/bookings', bookingsRouter);
  });

  test('blocks provider-to-client booking attempts', async () => {
    mockCurrentUserId = IDS.provider;
    usersById.set(IDS.provider, { _id: IDS.provider, accountType: 'provider' });
    usersById.set(IDS.otherClient, { _id: IDS.otherClient, accountType: 'client' });

    const response = await request(app)
      .post('/bookings')
      .send({
        providerId: IDS.otherClient,
        amount: 150
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toMatch(/account type pair/i);
    expect(mockTransactionCreate).not.toHaveBeenCalled();
  });

  test('allows client-to-provider booking', async () => {
    mockCurrentUserId = IDS.client;
    usersById.set(IDS.client, { _id: IDS.client, accountType: 'client' });
    usersById.set(IDS.provider, { _id: IDS.provider, accountType: 'provider' });

    const response = await request(app)
      .post('/bookings')
      .send({
        providerId: IDS.provider,
        amount: 250,
        notes: 'integration test booking'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.bookingId).toBeTruthy();
    expect(mockTransactionCreate).toHaveBeenCalledTimes(1);
  });
});
