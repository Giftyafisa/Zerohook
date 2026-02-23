/**
 * ConversationService Unit Tests — MongoDB/Mongoose
 * Tests the MongoDB-native ConversationService methods
 */
const mongoose = require('mongoose');

// Mock all Mongoose models used by ConversationService
const mockConversationFindById = jest.fn();
const mockConversationFindOne = jest.fn();
const mockConversationCreate = jest.fn();
const mockConversationFindByIdAndUpdate = jest.fn();
const mockConversationUpdateMany = jest.fn();

const mockMessageCreate = jest.fn();

const mockBlockedUserFindOne = jest.fn();
const mockBlockedUserFindOneAndUpdate = jest.fn();
const mockBlockedUserDeleteOne = jest.fn();
const mockBlockedUserFind = jest.fn();

jest.mock('../config/database', () => ({
  Conversation: {
    findById: (...args) => mockConversationFindById(...args),
    findOne: (...args) => mockConversationFindOne(...args),
    create: (...args) => mockConversationCreate(...args),
    findByIdAndUpdate: (...args) => mockConversationFindByIdAndUpdate(...args),
    updateMany: (...args) => mockConversationUpdateMany(...args),
  },
  Message: {
    create: (...args) => mockMessageCreate(...args),
  },
  BlockedUser: {
    findOne: (...args) => mockBlockedUserFindOne(...args),
    findOneAndUpdate: (...args) => mockBlockedUserFindOneAndUpdate(...args),
    deleteOne: (...args) => mockBlockedUserDeleteOne(...args),
    find: (...args) => mockBlockedUserFind(...args),
  },
}));

const ConversationService = require('../services/ConversationService');

describe('ConversationService (MongoDB)', () => {
  let cs;
  const fakeId = new mongoose.Types.ObjectId();
  const userId1 = new mongoose.Types.ObjectId();
  const userId2 = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
    cs = new ConversationService();
  });

  // --- isMember ---
  test('isMember returns true when user is participant1', async () => {
    mockConversationFindById.mockResolvedValueOnce({
      _id: fakeId,
      participant1Id: userId1,
      participant2Id: userId2,
    });
    const res = await cs.isMember(fakeId.toString(), userId1.toString());
    expect(res).toBe(true);
  });

  test('isMember returns true when user is participant2', async () => {
    mockConversationFindById.mockResolvedValueOnce({
      _id: fakeId,
      participant1Id: userId1,
      participant2Id: userId2,
    });
    const res = await cs.isMember(fakeId.toString(), userId2.toString());
    expect(res).toBe(true);
  });

  test('isMember returns false when conversation not found', async () => {
    mockConversationFindById.mockResolvedValueOnce(null);
    const res = await cs.isMember(fakeId.toString(), userId1.toString());
    expect(res).toBe(false);
  });

  test('isMember returns false on error', async () => {
    mockConversationFindById.mockRejectedValueOnce(new Error('db error'));
    const res = await cs.isMember(fakeId.toString(), userId1.toString());
    expect(res).toBe(false);
  });

  // --- isBlockedBetween ---
  test('isBlockedBetween returns true when a block record exists', async () => {
    mockBlockedUserFindOne.mockResolvedValueOnce({ blocker_id: userId1, blocked_id: userId2 });
    const res = await cs.isBlockedBetween(userId1.toString(), userId2.toString());
    expect(res).toBe(true);
    expect(mockBlockedUserFindOne).toHaveBeenCalledWith({
      $or: [
        { blocker_id: userId1.toString(), blocked_id: userId2.toString() },
        { blocker_id: userId2.toString(), blocked_id: userId1.toString() },
      ],
    });
  });

  test('isBlockedBetween returns false when no block record', async () => {
    mockBlockedUserFindOne.mockResolvedValueOnce(null);
    const res = await cs.isBlockedBetween(userId1.toString(), userId2.toString());
    expect(res).toBe(false);
  });

  // --- createOrGetConversation ---
  test('returns existing conversation when found', async () => {
    const now = new Date();
    mockConversationFindOne.mockResolvedValueOnce({
      _id: fakeId,
      createdAt: now,
    });
    const res = await cs.createOrGetConversation(userId1.toString(), userId2.toString());
    expect(res).toEqual({ id: fakeId, created_at: now });
    expect(mockConversationCreate).not.toHaveBeenCalled();
  });

  test('creates new conversation when none exists', async () => {
    const now = new Date();
    mockConversationFindOne.mockResolvedValueOnce(null);
    mockConversationCreate.mockResolvedValueOnce({
      _id: fakeId,
      createdAt: now,
    });
    const res = await cs.createOrGetConversation(userId1.toString(), userId2.toString());
    expect(res).toEqual({ id: fakeId, created_at: now });
    expect(mockConversationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        participant1Id: userId1.toString(),
        participant2Id: userId2.toString(),
        status: 'active',
      })
    );
  });

  // --- insertMessageTx ---
  test('creates message and updates conversation', async () => {
    const msgId = new mongoose.Types.ObjectId();
    const now = new Date();
    mockMessageCreate.mockResolvedValueOnce({
      _id: msgId,
      createdAt: now,
      metadata: { foo: 'bar' },
    });
    mockConversationFindByIdAndUpdate.mockResolvedValueOnce({});

    const res = await cs.insertMessageTx({
      conversationId: fakeId.toString(),
      senderId: userId1.toString(),
      content: 'hello',
      messageType: 'text',
      metadata: { foo: 'bar' },
    });

    expect(res._id).toEqual(msgId);
    expect(res.id).toEqual(msgId);
    expect(mockMessageCreate).toHaveBeenCalled();
    expect(mockConversationFindByIdAndUpdate).toHaveBeenCalledWith(
      fakeId.toString(),
      expect.objectContaining({ lastMessage: 'hello' })
    );
  });

  test('insertMessageTx formats image preview', async () => {
    const msgId = new mongoose.Types.ObjectId();
    mockMessageCreate.mockResolvedValueOnce({ _id: msgId, createdAt: new Date(), metadata: {} });
    mockConversationFindByIdAndUpdate.mockResolvedValueOnce({});

    await cs.insertMessageTx({
      conversationId: fakeId.toString(),
      senderId: userId1.toString(),
      content: 'image.jpg',
      messageType: 'image',
    });

    expect(mockConversationFindByIdAndUpdate).toHaveBeenCalledWith(
      fakeId.toString(),
      expect.objectContaining({ lastMessage: '📷 Photo' })
    );
  });

  // --- blockUser ---
  test('blockUser creates block record and marks conversations', async () => {
    mockBlockedUserFindOneAndUpdate.mockResolvedValueOnce({});
    mockConversationUpdateMany.mockResolvedValueOnce({});

    const res = await cs.blockUser(userId1.toString(), userId2.toString());
    expect(res).toEqual({ success: true, message: 'User blocked successfully' });
    expect(mockBlockedUserFindOneAndUpdate).toHaveBeenCalledWith(
      { blocker_id: userId1.toString(), blocked_id: userId2.toString() },
      expect.objectContaining({ blocker_id: userId1.toString(), blocked_id: userId2.toString() }),
      { upsert: true, new: true }
    );
    expect(mockConversationUpdateMany).toHaveBeenCalled();
  });

  // --- unblockUser ---
  test('unblockUser removes block record and restores conversations', async () => {
    mockBlockedUserDeleteOne.mockResolvedValueOnce({});
    mockConversationUpdateMany.mockResolvedValueOnce({});

    const res = await cs.unblockUser(userId1.toString(), userId2.toString());
    expect(res).toEqual({ success: true, message: 'User unblocked successfully' });
    expect(mockBlockedUserDeleteOne).toHaveBeenCalledWith({
      blocker_id: userId1.toString(),
      blocked_id: userId2.toString(),
    });
  });
});
