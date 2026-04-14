const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

const TEST_USER_ID = '507f1f77bcf86cd799439011';

const mockTxFindOne = jest.fn();
const mockTxFindOneAndUpdate = jest.fn();
const mockInvoiceFindOne = jest.fn();
const mockSubscriptionFindOneAndUpdate = jest.fn();
const mockUserFindByIdAndUpdate = jest.fn();
const mockNotificationCreateAndEmit = jest.fn();

const makeLean = (value) => ({ lean: () => Promise.resolve(value) });

jest.mock('../routes/auth', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { userId: '507f1f77bcf86cd799439011' };
    next();
  }
}));

jest.mock('../config/database', () => ({
  Transaction: {
    findOne: (...args) => mockTxFindOne(...args),
    findOneAndUpdate: (...args) => mockTxFindOneAndUpdate(...args)
  },
  Service: {
    findById: jest.fn()
  },
  CryptoInvoice: {
    findOne: (...args) => mockInvoiceFindOne(...args)
  },
  Subscription: {
    findOneAndUpdate: (...args) => mockSubscriptionFindOneAndUpdate(...args)
  },
  User: {
    findByIdAndUpdate: (...args) => mockUserFindByIdAndUpdate(...args),
    findById: jest.fn()
  }
}));

jest.mock('../services/NotificationService', () => ({
  createAndEmit: (...args) => mockNotificationCreateAndEmit(...args)
}));

const paymentsRouter = require('../routes/payments');

describe('Payments Route - verify-inline', () => {
  let app;
  let mockCheckPaymentStatus;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckPaymentStatus = jest.fn();

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.cryptoPaymentManager = {
        checkPaymentStatus: mockCheckPaymentStatus
      };
      req.io = {
        to: jest.fn(() => ({ emit: jest.fn() }))
      };
      next();
    });
    app.use('/payments', paymentsRouter);
  });

  test('returns confirmed_unlinked when blockchain confirms but no local record is activated', async () => {
    mockTxFindOne.mockResolvedValueOnce(null);
    mockInvoiceFindOne.mockReturnValueOnce(
      makeLean({
        reference: 'CRYPTO_REF_1',
        userId: new mongoose.Types.ObjectId(TEST_USER_ID),
        metadata: { type: 'payment' }
      })
    );
    mockCheckPaymentStatus.mockResolvedValueOnce({
      success: true,
      status: 'confirmed',
      verification: { source: 'test' }
    });
    mockTxFindOneAndUpdate.mockResolvedValueOnce(null);

    const response = await request(app)
      .post('/payments/verify-inline')
      .send({ reference: 'CRYPTO_REF_1' });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.status).toBe('confirmed_unlinked');
  });

  test('activates pending escrow when invoice metadata indicates escrow flow', async () => {
    const escrowId = '507f1f77bcf86cd799439099';
    const escrowTx = {
      _id: new mongoose.Types.ObjectId(escrowId),
      amount: 250,
      currency: 'NGN',
      type: 'escrow_hold'
    };

    mockTxFindOne.mockResolvedValueOnce(null);
    mockInvoiceFindOne.mockReturnValueOnce(
      makeLean({
        reference: 'CRYPTO_REF_2',
        userId: new mongoose.Types.ObjectId(TEST_USER_ID),
        metadata: { type: 'escrow', escrowId }
      })
    );
    mockCheckPaymentStatus.mockResolvedValueOnce({
      success: true,
      status: 'confirmed',
      verification: { source: 'test' }
    });
    mockTxFindOneAndUpdate.mockResolvedValueOnce(escrowTx);

    const response = await request(app)
      .post('/payments/verify-inline')
      .send({ reference: 'CRYPTO_REF_2' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.escrowActivated).toBe(true);
    expect(response.body.transactionType).toBe('escrow_hold');
  });
});
