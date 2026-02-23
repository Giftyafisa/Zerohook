/**
 * chatIntegration.test.js
 * Integration-style tests for chat REST API endpoints using MongoDB
 * These mock Mongoose models and test route handler logic
 */

// ---------- Mongoose Model Mocks ----------
// Jest requires mock variables to be prefixed with 'mock'
const mockFindById = jest.fn();
const mockFindOne = jest.fn();
const mockCreate = jest.fn();
const mockFindByIdAndUpdate = jest.fn();

jest.mock('../config/database', () => ({
  Conversation: {
    findById: (...a) => mockFindById(...a),
    findOne: (...a) => mockFindOne(...a),
    create: (...a) => mockCreate(...a),
    findByIdAndUpdate: (...a) => mockFindByIdAndUpdate(...a),
    updateMany: jest.fn().mockResolvedValue({}),
  },
  Message: {
    create: (...a) => mockCreate(...a),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    }),
  },
  BlockedUser: {
    findOne: jest.fn().mockResolvedValue(null),
    findOneAndUpdate: jest.fn().mockResolvedValue({}),
    deleteOne: jest.fn().mockResolvedValue({}),
  },
  User: {
    findById: jest.fn(),
  },
  connectDB: jest.fn(),
  mongoose: require('mongoose'),
  query: jest.fn(),
  getClient: jest.fn(),
}));

const ConversationService = require('../services/ConversationService');
const mongoose = require('mongoose');

describe('Chat Integration — MongoDB', () => {
  let cs;
  const userA = new mongoose.Types.ObjectId();
  const userB = new mongoose.Types.ObjectId();
  const convId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
    cs = new ConversationService();
  });

  // Conversation creation flow
  test('createOrGetConversation returns existing conversation', async () => {
    const now = new Date();
    mockFindOne.mockResolvedValueOnce({ _id: convId, createdAt: now });

    const result = await cs.createOrGetConversation(userA.toString(), userB.toString());
    expect(result.id).toEqual(convId);
    expect(result.created_at).toEqual(now);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('createOrGetConversation creates new when none exists', async () => {
    const now = new Date();
    mockFindOne.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce({ _id: convId, createdAt: now });

    const result = await cs.createOrGetConversation(userA.toString(), userB.toString());
    expect(result.id).toEqual(convId);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ participant1Id: userA.toString(), participant2Id: userB.toString() })
    );
  });

  // Membership verification
  test('isMember returns true for participant1', async () => {
    mockFindById.mockResolvedValueOnce({ participant1Id: userA, participant2Id: userB });
    expect(await cs.isMember(convId.toString(), userA.toString())).toBe(true);
  });

  test('isMember returns false for non-participant', async () => {
    const stranger = new mongoose.Types.ObjectId();
    mockFindById.mockResolvedValueOnce({ participant1Id: userA, participant2Id: userB });
    expect(await cs.isMember(convId.toString(), stranger.toString())).toBe(false);
  });

  // Message sending flow
  test('insertMessageTx creates message and updates conversation', async () => {
    const msgId = new mongoose.Types.ObjectId();
    const now = new Date();
    mockCreate.mockResolvedValueOnce({ _id: msgId, createdAt: now, metadata: {} });
    mockFindByIdAndUpdate.mockResolvedValueOnce({});

    const msg = await cs.insertMessageTx({
      conversationId: convId.toString(),
      senderId: userA.toString(),
      content: 'Hello from test',
      messageType: 'text',
      metadata: {},
    });

    expect(msg._id).toEqual(msgId);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: convId.toString(), content: 'Hello from test' })
    );
    expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
      convId.toString(),
      expect.objectContaining({ lastMessage: 'Hello from test', lastMessageType: 'text' })
    );
  });

  // Block/unblock flow
  test('blockUser blocks and marks conversations', async () => {
    const { BlockedUser, Conversation } = require('../config/database');
    // Re-mock for this test
    BlockedUser.findOneAndUpdate = jest.fn().mockResolvedValue({});
    Conversation.updateMany = jest.fn().mockResolvedValue({});

    // Re-instantiate to get fresh mocks
    const freshCs = new ConversationService();
    const result = await freshCs.blockUser(userA.toString(), userB.toString());
    expect(result.success).toBe(true);
  });

  test('isBlockedBetween returns false when no block exists', async () => {
    const { BlockedUser } = require('../config/database');
    BlockedUser.findOne = jest.fn().mockResolvedValue(null);

    const freshCs = new ConversationService();
    expect(await freshCs.isBlockedBetween(userA.toString(), userB.toString())).toBe(false);
  });

  test('isBlockedBetween returns true when block exists', async () => {
    const { BlockedUser } = require('../config/database');
    BlockedUser.findOne = jest.fn().mockResolvedValue({ blocker_id: userA, blocked_id: userB });

    const freshCs = new ConversationService();
    expect(await freshCs.isBlockedBetween(userA.toString(), userB.toString())).toBe(true);
  });
});
