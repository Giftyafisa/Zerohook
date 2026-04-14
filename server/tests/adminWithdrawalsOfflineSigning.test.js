const express = require('express');
const request = require('supertest');

const WITHDRAWAL_ID = '507f1f77bcf86cd799439091';
const USER_ID = '507f1f77bcf86cd799439011';
const ADMIN_ONE = '507f1f77bcf86cd7994390a1';
const ADMIN_TWO = '507f1f77bcf86cd7994390a2';

let mockAuthUser = { userId: ADMIN_ONE, isAdmin: true };

const mockTxFindOne = jest.fn();
const mockTxFindOneAndUpdate = jest.fn();
const mockBuildOfflineSigningRequest = jest.fn();

const makeLean = (value) => ({ lean: () => Promise.resolve(value) });

jest.mock('../routes/auth', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { ...mockAuthUser };
    next();
  }
}));

jest.mock('../config/database', () => ({
  Transaction: {
    findOne: (...args) => mockTxFindOne(...args),
    findOneAndUpdate: (...args) => mockTxFindOneAndUpdate(...args),
    find: jest.fn(),
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn()
  },
  Subscription: {
    countDocuments: jest.fn()
  },
  User: {
    findById: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn()
  }
}));

const adminRouter = require('../routes/admin');

const buildPendingWithdrawal = (overrides = {}) => ({
  _id: WITHDRAWAL_ID,
  reference: 'WD_REF_001',
  type: 'withdrawal',
  status: 'pending',
  amount: 450,
  currency: 'USD',
  user_id: USER_ID,
  metadata: {
    destinationAddress: '0x1234567890abcdef1234567890abcdef12345678',
    cryptoSymbol: 'USDT',
    cryptoAmount: 300
  },
  ...overrides
});

describe('Admin withdrawal offline signing integration', () => {
  let app;
  let emitMock;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.WITHDRAWAL_MULTISIG_ENABLED;
    delete process.env.MULTISIG_WITHDRAWAL_ENABLED;
    delete process.env.WITHDRAWAL_MULTISIG_THRESHOLD_USD;
    delete process.env.MULTISIG_WITHDRAWAL_THRESHOLD_USD;
    delete process.env.WITHDRAWAL_MULTISIG_REQUIRED_APPROVALS;
    delete process.env.MULTISIG_WITHDRAWAL_REQUIRED_APPROVALS;

    mockAuthUser = { userId: ADMIN_ONE, isAdmin: true };
    emitMock = jest.fn();
    mockBuildOfflineSigningRequest.mockReturnValue({
      requestId: 'SIGNREQ_USDT_1',
      digest: 'abc123',
      algorithm: 'sha256',
      payload: {
        reference: 'WD_REF_001',
        asset: 'USDT',
        to: '0x1234567890abcdef1234567890abcdef12345678',
        amount: 300
      }
    });

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.cryptoPaymentManager = {
        buildOfflineSigningRequest: mockBuildOfflineSigningRequest
      };
      req.io = {
        to: jest.fn(() => ({ emit: emitMock }))
      };
      next();
    });
    app.use('/admin', adminRouter);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('completes approve -> signing-request -> submit-signed flow', async () => {
    const pending = buildPendingWithdrawal();
    const signingRequest = {
      requestId: 'SIGNREQ_USDT_1',
      digest: 'abc123',
      algorithm: 'sha256',
      payload: {
        reference: 'WD_REF_001',
        asset: 'USDT',
        to: '0x1234567890abcdef1234567890abcdef12345678',
        amount: 300
      }
    };
    const awaitingSignature = {
      ...pending,
      status: 'awaiting_signature',
      metadata: {
        ...pending.metadata,
        offlineSigningRequest: signingRequest
      }
    };
    const completed = {
      ...awaitingSignature,
      status: 'completed',
      metadata: {
        ...awaitingSignature.metadata,
        txHash: '0xhash001'
      }
    };

    mockTxFindOne.mockResolvedValueOnce(pending);
    mockTxFindOneAndUpdate.mockResolvedValueOnce(awaitingSignature);
    mockTxFindOne.mockReturnValueOnce(makeLean(awaitingSignature));
    mockTxFindOneAndUpdate.mockResolvedValueOnce(completed);

    const approveResponse = await request(app)
      .post(`/admin/withdrawals/${WITHDRAWAL_ID}/approve`)
      .send({ notes: 'approved for offline signing' });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.success).toBe(true);
    expect(approveResponse.body.withdrawal.status).toBe('awaiting_signature');
    expect(approveResponse.body.signingRequest.requestId).toBe('SIGNREQ_USDT_1');

    const signingRequestResponse = await request(app)
      .get(`/admin/withdrawals/${WITHDRAWAL_ID}/signing-request`);

    expect(signingRequestResponse.status).toBe(200);
    expect(signingRequestResponse.body.success).toBe(true);
    expect(signingRequestResponse.body.signingRequest.requestId).toBe('SIGNREQ_USDT_1');

    const submitSignedResponse = await request(app)
      .post(`/admin/withdrawals/${WITHDRAWAL_ID}/submit-signed`)
      .send({
        txHash: '0xhash001',
        signerDevice: 'ledger',
        notes: 'broadcasted on mainnet'
      });

    expect(submitSignedResponse.status).toBe(200);
    expect(submitSignedResponse.body.success).toBe(true);
    expect(submitSignedResponse.body.withdrawal.status).toBe('completed');
    expect(submitSignedResponse.body.withdrawal.txHash).toBe('0xhash001');
    expect(mockBuildOfflineSigningRequest).toHaveBeenCalledTimes(1);
  });

  test('returns 404 when approve is called for missing pending withdrawal', async () => {
    mockTxFindOne.mockResolvedValueOnce(null);

    const response = await request(app)
      .post(`/admin/withdrawals/${WITHDRAWAL_ID}/approve`)
      .send({ notes: 'approve missing' });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Pending withdrawal not found');
  });

  test('returns 404 when signing request does not exist', async () => {
    const pending = buildPendingWithdrawal({ metadata: { destinationAddress: '0xabc' } });
    mockTxFindOne.mockReturnValueOnce(makeLean(pending));

    const response = await request(app)
      .get(`/admin/withdrawals/${WITHDRAWAL_ID}/signing-request`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('No signing request found for this withdrawal');
  });

  test('returns 400 when submit-signed request is missing txHash', async () => {
    const response = await request(app)
      .post(`/admin/withdrawals/${WITHDRAWAL_ID}/submit-signed`)
      .send({ signerDevice: 'ledger' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('txHash is required');
    expect(mockTxFindOneAndUpdate).not.toHaveBeenCalled();
  });

  test('enforces optional multisig policy for high-value withdrawals', async () => {
    process.env.WITHDRAWAL_MULTISIG_ENABLED = 'true';
    process.env.WITHDRAWAL_MULTISIG_THRESHOLD_USD = '1000';
    process.env.WITHDRAWAL_MULTISIG_REQUIRED_APPROVALS = '2';

    const highValuePending = buildPendingWithdrawal({ amount: 2500 });
    const signingRequest = {
      requestId: 'SIGNREQ_USDT_1',
      digest: 'abc123',
      algorithm: 'sha256',
      payload: {
        reference: 'WD_REF_001',
        asset: 'USDT',
        to: '0x1234567890abcdef1234567890abcdef12345678',
        amount: 300
      }
    };
    const afterFirstApproval = {
      ...highValuePending,
      status: 'pending',
      metadata: {
        ...highValuePending.metadata,
        multisigPolicy: {
          enabled: true,
          thresholdAmount: 1000,
          requiredApprovals: 2,
          approvals: [{ adminId: ADMIN_ONE, approvedAt: new Date().toISOString() }]
        }
      }
    };

    const afterSecondApproval = {
      ...afterFirstApproval,
      status: 'awaiting_signature',
      metadata: {
        ...afterFirstApproval.metadata,
        multisigPolicy: {
          ...afterFirstApproval.metadata.multisigPolicy,
          approvals: [
            ...afterFirstApproval.metadata.multisigPolicy.approvals,
            { adminId: ADMIN_TWO, approvedAt: new Date().toISOString() }
          ]
        },
        offlineSigningRequest: signingRequest
      }
    };

    mockTxFindOne.mockResolvedValueOnce(highValuePending);
    mockTxFindOneAndUpdate.mockResolvedValueOnce(afterFirstApproval);

    const firstApproval = await request(app)
      .post(`/admin/withdrawals/${WITHDRAWAL_ID}/approve`)
      .send({ notes: 'first signer' });

    expect(firstApproval.status).toBe(202);
    expect(firstApproval.body.success).toBe(true);
    expect(firstApproval.body.multisig.remainingApprovals).toBe(1);
    expect(firstApproval.body.withdrawal.status).toBe('pending');

    mockAuthUser = { userId: ADMIN_TWO, isAdmin: true };
    mockTxFindOne.mockResolvedValueOnce(afterFirstApproval);
    mockTxFindOneAndUpdate.mockResolvedValueOnce(afterSecondApproval);

    const secondApproval = await request(app)
      .post(`/admin/withdrawals/${WITHDRAWAL_ID}/approve`)
      .send({ notes: 'second signer' });

    expect(secondApproval.status).toBe(200);
    expect(secondApproval.body.success).toBe(true);
    expect(secondApproval.body.withdrawal.status).toBe('awaiting_signature');
    expect(secondApproval.body.multisig.receivedApprovals).toBe(2);
    expect(secondApproval.body.signingRequest.requestId).toBe('SIGNREQ_USDT_1');
  });
});
