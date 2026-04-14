const express = require('express');
const request = require('supertest');

const mockUserFindById = jest.fn();
const mockSugarAccessFindOne = jest.fn();
const mockSugarAccessCreate = jest.fn();

let mockCheckPaymentStatus;

jest.mock('../routes/auth', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { userId: '507f1f77bcf86cd799439011' };
    next();
  }
}));

jest.mock('../middleware/requireSubscription', () => {
  return jest.fn(() => (req, res, next) => next());
});

jest.mock('../config/database', () => ({
  User: {
    findById: (...args) => mockUserFindById(...args)
  },
  SugarAccessPayment: {
    findOne: (...args) => mockSugarAccessFindOne(...args),
    create: (...args) => mockSugarAccessCreate(...args)
  }
}));

const sugarAccessRouter = require('../routes/sugarAccess');

describe('Sugar Access Route', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckPaymentStatus = jest.fn();

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.currencyManager = {
        fiatToCrypto: jest.fn().mockResolvedValue({ cryptoAmount: 1.1, rate: 1 })
      };
      req.cryptoPaymentManager = {
        createPaymentInvoice: jest.fn(),
        checkPaymentStatus: mockCheckPaymentStatus
      };
      next();
    });
    app.use('/sugar-access', sugarAccessRouter);
  });

  test('initialize rejects unsupported crypto symbols outside settlement allowlist', async () => {
    const response = await request(app)
      .post('/sugar-access/initialize')
      .send({ accessType: 'sugar_daddy', cryptoSymbol: 'BNB' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.validCryptos).toEqual(['BTC', 'ETH', 'USDT', 'USDC']);
  });

  test('verify marks payment completed when blockchain status is confirmed', async () => {
    const paymentDoc = {
      paymentStatus: 'pending',
      paymentReference: 'CRYPTO_SUGAR_1',
      accessType: 'sugar_daddy',
      accessExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
      save: jest.fn().mockResolvedValue(undefined)
    };

    mockSugarAccessFindOne.mockResolvedValue(paymentDoc);
    mockCheckPaymentStatus.mockResolvedValue({ success: true, status: 'confirmed' });

    const response = await request(app)
      .post('/sugar-access/verify')
      .send({ reference: 'CRYPTO_SUGAR_1' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Payment verified successfully');
    expect(paymentDoc.paymentStatus).toBe('completed');
    expect(paymentDoc.save).toHaveBeenCalledTimes(1);
  });
});
