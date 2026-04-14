const express = require('express');
const request = require('supertest');

const TEST_USER_ID = '507f1f77bcf86cd799439011';
const TEST_ESCROW_ID = '507f1f77bcf86cd799439021';

const mockTxFindByIdAndUpdate = jest.fn();

const mockAssessTransactionRisk = jest.fn();
const mockGetUserCountry = jest.fn();
const mockCreateEscrow = jest.fn();
const mockFiatToCrypto = jest.fn();
const mockCreatePaymentInvoice = jest.fn();

jest.mock('../routes/auth', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { userId: '507f1f77bcf86cd799439011' };
    next();
  }
}));

jest.mock('../config/database', () => ({
  Transaction: {
    findByIdAndUpdate: (...args) => mockTxFindByIdAndUpdate(...args),
    findById: jest.fn()
  },
  User: {}
}));

const escrowRouter = require('../routes/escrow');

describe('Escrow Route - crypto create flow', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.trustEngine = { assessTransactionRisk: mockAssessTransactionRisk };
      req.countryManager = { getUserCountry: mockGetUserCountry };
      req.escrowManager = { createEscrow: mockCreateEscrow };
      req.currencyManager = { fiatToCrypto: mockFiatToCrypto };
      req.cryptoPaymentManager = { createPaymentInvoice: mockCreatePaymentInvoice };
      next();
    });
    app.use('/escrow', escrowRouter);

    mockAssessTransactionRisk.mockResolvedValue({
      riskLevel: 'low',
      riskFactors: [],
      recommendations: []
    });
    mockGetUserCountry.mockResolvedValue({ country: { currency: 'NGN' } });
    mockCreateEscrow.mockResolvedValue({
      id: TEST_ESCROW_ID,
      transactionId: TEST_ESCROW_ID,
      completionPin: '123456',
      status: 'held'
    });
  });

  test('uses numeric conversion.cryptoAmount and sets escrow pending_payment', async () => {
    mockFiatToCrypto.mockResolvedValue({
      cryptoAmount: 0.25,
      rate: 1500
    });
    mockCreatePaymentInvoice.mockResolvedValue({
      reference: 'CRYPTO_ESCROW_1',
      address: '0xabc123',
      cryptoAmount: 0.25,
      cryptoSymbol: 'USDT',
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
      network: 'Ethereum (ERC-20)'
    });
    mockTxFindByIdAndUpdate.mockResolvedValue({});

    const response = await request(app)
      .post('/escrow/create')
      .send({
        providerId: '507f1f77bcf86cd799439031',
        amount: 100,
        paymentMethod: 'crypto',
        cryptoSymbol: 'USDT'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.transaction.status).toBe('pending_payment');
    expect(response.body.reference).toBe('CRYPTO_ESCROW_1');
    expect(mockCreatePaymentInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        cryptoAmount: 0.25,
        cryptoSymbol: 'USDT',
        transactionId: TEST_ESCROW_ID,
        userId: TEST_USER_ID,
        metadata: expect.objectContaining({ type: 'escrow', escrowId: TEST_ESCROW_ID })
      })
    );
    expect(mockTxFindByIdAndUpdate).toHaveBeenCalledWith(
      TEST_ESCROW_ID,
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'pending_payment' })
      })
    );
  });

  test('returns 502 and marks payment_failed when crypto invoice initialization fails', async () => {
    mockFiatToCrypto.mockResolvedValue({ cryptoAmount: 0.12, rate: 900 });
    mockCreatePaymentInvoice.mockRejectedValue(new Error('provider unavailable'));
    mockTxFindByIdAndUpdate.mockResolvedValue({});

    const response = await request(app)
      .post('/escrow/create')
      .send({
        providerId: '507f1f77bcf86cd799439031',
        amount: 100,
        paymentMethod: 'crypto',
        cryptoSymbol: 'USDT'
      });

    expect(response.status).toBe(502);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Failed to initialize crypto payment for escrow');
    expect(mockTxFindByIdAndUpdate).toHaveBeenCalledWith(
      TEST_ESCROW_ID,
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'payment_failed' })
      })
    );
  });

  test('rejects unsupported crypto symbols for escrow payments', async () => {
    const response = await request(app)
      .post('/escrow/create')
      .send({
        providerId: '507f1f77bcf86cd799439031',
        amount: 100,
        paymentMethod: 'crypto',
        cryptoSymbol: 'BNB'
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Unsupported crypto for escrow');
    expect(mockCreateEscrow).not.toHaveBeenCalled();
  });
});
