const express = require('express');
const request = require('supertest');

const TEST_USER_ID = '507f1f77bcf86cd799439011';
const TEST_TX_ID = '507f1f77bcf86cd799439021';

const mockTxFind = jest.fn();
const mockTxCountDocuments = jest.fn();
const mockTxAggregate = jest.fn();
const mockTxFindOne = jest.fn();

jest.mock('../routes/auth', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { userId: TEST_USER_ID };
    next();
  }
}));

jest.mock('../config/database', () => ({
  Transaction: {
    find: (...args) => mockTxFind(...args),
    countDocuments: (...args) => mockTxCountDocuments(...args),
    aggregate: (...args) => mockTxAggregate(...args),
    findOne: (...args) => mockTxFindOne(...args)
  }
}));

const transactionsRouter = require('../routes/transactions');

describe('Transactions response smoke', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/transactions', transactionsRouter);

    mockTxFind.mockImplementation(() => ({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: TEST_TX_ID,
          client_id: TEST_USER_ID,
          provider_id: '507f1f77bcf86cd799439012',
          amount: 150,
          currency: 'GHS',
          payment_method: 'crypto',
          reference: 'PAY_REF_001',
          escrow_address: '0xabc123',
          type: 'service',
          status: 'completed',
          scheduled_time: new Date('2026-04-17T09:00:00.000Z'),
          location_data: { city: 'Accra' },
          created_at: new Date('2026-04-17T08:00:00.000Z'),
          updated_at: new Date('2026-04-17T08:10:00.000Z'),
          completed_at: new Date('2026-04-17T08:30:00.000Z'),
          service_id: {
            _id: '507f1f77bcf86cd799439013',
            title: 'VIP Service',
            description: 'Service description',
            category_id: { display_name: 'Premium' }
          }
        }
      ])
    }));

    mockTxCountDocuments.mockResolvedValue(1);
    mockTxAggregate.mockResolvedValue([
      {
        completed: [{ count: 1, earnings: 0, spent: 150 }],
        pending: [{ count: 0 }],
        cancelled: [{ count: 0 }]
      }
    ]);

    mockTxFindOne.mockImplementation(() => ({
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        _id: TEST_TX_ID,
        client_id: { _id: TEST_USER_ID, username: 'client-user' },
        provider_id: { _id: '507f1f77bcf86cd799439012', username: 'provider-user' },
        amount: 150,
        currency: 'GHS',
        payment_method: 'crypto',
        reference: 'PAY_REF_001',
        escrow_address: '0xabc123',
        type: 'service',
        status: 'completed',
        service_id: {
          _id: '507f1f77bcf86cd799439013',
          title: 'VIP Service',
          description: 'Service description',
          category_id: { display_name: 'Premium' }
        }
      })
    }));
  });

  test('GET /transactions includes payment method/reference fields in list payload', async () => {
    const response = await request(app).get('/transactions?page=1&limit=20');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.transactions[0]).toEqual(
      expect.objectContaining({
        payment_method: 'crypto',
        paymentMethod: 'crypto',
        payment_reference: 'PAY_REF_001',
        paymentReference: 'PAY_REF_001',
        escrow_address: '0xabc123',
        transaction_type: 'service'
      })
    );
  });

  test('GET /transactions/:id includes payment method/reference fields in detail payload', async () => {
    const response = await request(app).get(`/transactions/${TEST_TX_ID}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.transaction).toEqual(
      expect.objectContaining({
        payment_method: 'crypto',
        paymentMethod: 'crypto',
        payment_reference: 'PAY_REF_001',
        paymentReference: 'PAY_REF_001',
        escrow_address: '0xabc123',
        transaction_type: 'service'
      })
    );
  });
});
