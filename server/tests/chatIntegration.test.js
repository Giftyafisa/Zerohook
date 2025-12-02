// chatIntegration.test.js
// Integration tests for chat flows: websocket handshake, join_conversation, send_message (blocked/allowed), REST /api/chat/send

const request = require('supertest');
const io = require('socket.io-client');
const app = require('../index'); // Express app
const { Pool } = require('pg');

const WS_URL = process.env.WS_URL || 'http://localhost:3001';
const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_USER_A = { username: 'testuserA', password: 'testpassA' };
const TEST_USER_B = { username: 'testuserB', password: 'testpassB' };

let userAToken, userBToken, conversationId;

beforeAll(async () => {
  // Register/login users and get JWTs
  const resA = await request(API_URL).post('/api/auth/login').send(TEST_USER_A);
  userAToken = resA.body.token;
  const resB = await request(API_URL).post('/api/auth/login').send(TEST_USER_B);
  userBToken = resB.body.token;
});

describe('Chat Integration Flows', () => {
  test('Websocket handshake authenticates with JWT', (done) => {
    const socket = io(WS_URL, {
      auth: { token: userAToken }
    });
    socket.on('connect', () => {
      expect(socket.connected).toBe(true);
      socket.disconnect();
      done();
    });
    socket.on('connect_error', (err) => {
      done(err);
    });
  });

  test('REST /api/chat/conversation creates or gets conversation', async () => {
    const res = await request(API_URL)
      .post('/api/chat/conversation')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ participantId: resB.body.user.id });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.conversationId).toBeDefined();
    conversationId = res.body.data.conversationId;
  });

  test('join_conversation socket event succeeds for member', (done) => {
    const socket = io(WS_URL, { auth: { token: userAToken } });
    socket.emit('join_conversation', { conversationId });
    socket.on('joined_conversation', (data) => {
      expect(data.conversationId).toBe(conversationId);
      socket.disconnect();
      done();
    });
    socket.on('error', (err) => done(err));
  });

  test('send_message socket event delivers and persists message', (done) => {
    const socket = io(WS_URL, { auth: { token: userAToken } });
    socket.emit('join_conversation', { conversationId });
    socket.emit('send_message', {
      conversationId,
      content: 'Hello from integration test',
      metadata: {}
    });
    socket.on('new_message', (msg) => {
      expect(msg.content).toBe('Hello from integration test');
      expect(msg.conversationId).toBe(conversationId);
      socket.disconnect();
      done();
    });
    socket.on('error', (err) => done(err));
  });

  test('send_message is blocked if user is blocked', async () => {
    // Block userA from userB
    await request(API_URL)
      .post('/api/chat/block-user')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ blockedUserId: resA.body.user.id });
    // Try to send message as userA
    const socket = io(WS_URL, { auth: { token: userAToken } });
    socket.emit('join_conversation', { conversationId });
    socket.emit('send_message', {
      conversationId,
      content: 'Blocked message',
      metadata: {}
    });
    socket.on('message_blocked', (data) => {
      expect(data.reason).toMatch(/blocked/i);
      socket.disconnect();
      done();
    });
    socket.on('new_message', () => {
      socket.disconnect();
      done(new Error('Message should not be delivered'));
    });
    socket.on('error', (err) => done(err));
  });

  test('REST /api/chat/send delivers and persists message', async () => {
    const res = await request(API_URL)
      .post('/api/chat/send')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ conversationId, content: 'REST message', metadata: {} });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.messageId).toBeDefined();
  });
});
