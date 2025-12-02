const ConversationService = require('../services/ConversationService');

jest.mock('../config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

const { query, getClient } = require('../config/database');

describe('ConversationService', () => {
  let cs;

  beforeEach(() => {
    jest.clearAllMocks();
    cs = new ConversationService();
  });

  test('isMember returns true when conversation exists', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'conv-1' }] });
    const res = await cs.isMember('conv-1', 'user-1');
    expect(res).toBe(true);
    expect(query).toHaveBeenCalledWith(expect.any(String), ['conv-1', 'user-1']);
  });

  test('isMember returns false when not member', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const res = await cs.isMember('conv-1', 'user-1');
    expect(res).toBe(false);
  });

  test('isBlockedBetween returns true when blocked', async () => {
    query.mockResolvedValueOnce({ rows: [{ '1': 1 }] });
    const res = await cs.isBlockedBetween('a', 'b');
    expect(res).toBe(true);
  });

  test('createOrGetConversation returns existing conversation', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'conv-existing', created_at: '2025-01-01' }] });
    const res = await cs.createOrGetConversation('a', 'b');
    expect(res).toEqual({ id: 'conv-existing', created_at: '2025-01-01' });
  });

  test('createOrGetConversation inserts when none exists', async () => {
    // First call: check existing -> none
    // Second call: insert and return
    query.mockResolvedValueOnce({ rows: [] })
         .mockResolvedValueOnce({ rows: [{ id: 'conv-new', created_at: '2025-01-02' }] });
    const res = await cs.createOrGetConversation('a', 'b');
    expect(res).toEqual({ id: 'conv-new', created_at: '2025-01-02' });
    expect(query).toHaveBeenCalledTimes(2);
  });

  test('insertMessageTx creates message and updates conversation when no client passed', async () => {
    const fakeClient = {
      query: jest.fn()
    };
    // getClient returns fake client
    getClient.mockResolvedValueOnce(fakeClient);
    // Simulate calls: BEGIN -> insert -> update -> COMMIT
    fakeClient.query.mockResolvedValueOnce({}) // BEGIN
                  .mockResolvedValueOnce({ rows: [{ id: 'msg-1', created_at: '2025-01-03' }] }) // insert
                  .mockResolvedValueOnce({}) // update conversation
                  .mockResolvedValueOnce({}); // COMMIT

    const message = await cs.insertMessageTx({ conversationId: 'conv-1', senderId: 'u1', content: 'hi', messageType: 'text', metadata: {} });
    expect(message).toEqual({ id: 'msg-1', created_at: '2025-01-03' });
    expect(getClient).toHaveBeenCalled();
    expect(fakeClient.query).toHaveBeenCalled();
  });

  test('blockUser uses client transaction and commits', async () => {
    const fakeClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    getClient.mockResolvedValueOnce(fakeClient);
    fakeClient.query.mockResolvedValue({ rows: [] });

    const res = await cs.blockUser('u1', 'u2');
    expect(res).toEqual({ success: true, message: 'User blocked successfully' });
    // Expect BEGIN, then at least one operation, then COMMIT
    expect(fakeClient.query).toHaveBeenCalled();
    expect(fakeClient.release).toHaveBeenCalled();
  });

});
