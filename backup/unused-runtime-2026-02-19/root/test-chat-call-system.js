#!/usr/bin/env node

/**
 * Test Script for Chat & Call System Fixes
 * This script tests the socket.io functionality and API endpoints
 */

const io = require('socket.io-client');
const axios = require('axios');

const SERVER_URL = 'http://localhost:5000';
const API_URL = `${SERVER_URL}/api`;

// Test data
const testUsers = [
  {
    username: 'testuser1',
    email: 'test1@example.com',
    password: 'TestPassword123!',
    phone: '+1234567890'
  },
  {
    username: 'testuser2', 
    email: 'test2@example.com',
    password: 'TestPassword123!',
    phone: '+1234567891'
  }
];

let userTokens = [];
let sockets = [];

async function testAuthentication() {
  console.log('🔐 Testing Authentication...');
  
  try {
    // Register test users
    for (const user of testUsers) {
      try {
        await axios.post(`${API_URL}/auth/register`, user);
        console.log(`✅ Registered user: ${user.username}`);
      } catch (error) {
        if (error.response?.status === 400 && error.response.data.message?.includes('already exists')) {
          console.log(`ℹ️  User already exists: ${user.username}`);
        } else {
          console.error(`❌ Failed to register ${user.username}:`, error.response?.data || error.message);
        }
      }
    }

    // Login test users
    for (const user of testUsers) {
      try {
        const response = await axios.post(`${API_URL}/auth/login`, {
          email: user.email,
          password: user.password
        });
        
        if (response.data.token) {
          userTokens.push({
            username: user.username,
            token: response.data.token,
            user: response.data.user
          });
          console.log(`✅ Logged in user: ${user.username}`);
        }
      } catch (error) {
        console.error(`❌ Failed to login ${user.username}:`, error.response?.data || error.message);
      }
    }

    return userTokens.length === testUsers.length;
  } catch (error) {
    console.error('❌ Authentication test failed:', error.message);
    return false;
  }
}

async function testSocketConnection() {
  console.log('🔌 Testing Socket Connections...');
  
  try {
    for (const user of userTokens) {
      const socket = io(SERVER_URL, {
        auth: {
          token: user.token
        },
        timeout: 5000
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Socket connection timeout'));
        }, 5000);

        socket.on('connect', () => {
          clearTimeout(timeout);
          console.log(`✅ Socket connected for ${user.username}: ${socket.id}`);
          sockets.push({ socket, user });
          resolve();
        });

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    }

    return sockets.length === userTokens.length;
  } catch (error) {
    console.error('❌ Socket connection test failed:', error.message);
    return false;
  }
}

async function testChatSystem() {
  console.log('💬 Testing Chat System...');
  
  try {
    if (sockets.length < 2) {
      console.log('⚠️  Need at least 2 connected users for chat test');
      return false;
    }

    const [socket1, socket2] = sockets;
    const conversationId = 'test-conversation-123';

    // Join conversation room
    socket1.socket.emit('join_conversation', conversationId);
    socket2.socket.emit('join_conversation', conversationId);
    console.log('✅ Both users joined conversation room');

    // Set up message listeners
    let messageReceived = false;
    socket2.socket.on('new_message', (message) => {
      console.log(`📨 Message received by ${socket2.user.username}:`, message.content);
      messageReceived = true;
    });

    // Send test message
    const testMessage = 'Hello from chat system test!';
    socket1.socket.emit('send_message', {
      conversationId,
      content: testMessage,
      type: 'text'
    });
    console.log(`📤 Message sent by ${socket1.user.username}: ${testMessage}`);

    // Wait for message to be received
    await new Promise(resolve => setTimeout(resolve, 2000));

    return messageReceived;
  } catch (error) {
    console.error('❌ Chat system test failed:', error.message);
    return false;
  }
}

async function testCallSystem() {
  console.log('📞 Testing Call System...');
  
  try {
    if (sockets.length < 2) {
      console.log('⚠️  Need at least 2 connected users for call test');
      return false;
    }

    const [socket1, socket2] = sockets;
    let callReceived = false;
    let callAccepted = false;

    // Set up call listeners for user 2
    socket2.socket.on('incoming_call', (callData) => {
      console.log(`📞 Incoming call received by ${socket2.user.username}:`, callData);
      callReceived = true;
      
      // Auto-accept the call for testing
      setTimeout(() => {
        socket2.socket.emit('accept_call', {
          callId: callData.id,
          targetUserId: callData.callerId
        });
        console.log(`✅ Call accepted by ${socket2.user.username}`);
        callAccepted = true;
      }, 1000);
    });

    // Set up call accepted listener for user 1
    socket1.socket.on('call_accepted', (callData) => {
      console.log(`✅ Call accepted notification received by ${socket1.user.username}:`, callData);
    });

    // Send call request
    const callData = {
      targetUserId: socket2.user.id,
      callType: 'audio',
      id: Date.now().toString()
    };
    
    socket1.socket.emit('call_request', callData);
    console.log(`📞 Call request sent by ${socket1.user.username} to ${socket2.user.username}`);

    // Wait for call flow to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    return callReceived && callAccepted;
  } catch (error) {
    console.error('❌ Call system test failed:', error.message);
    return false;
  }
}

async function cleanup() {
  console.log('🧹 Cleaning up...');
  
  // Disconnect all sockets
  for (const { socket } of sockets) {
    socket.disconnect();
  }
  
  console.log('✅ Cleanup completed');
}

async function runTests() {
  console.log('🚀 Starting Chat & Call System Tests');
  console.log('=====================================');
  
  const results = {
    authentication: false,
    socketConnection: false,
    chatSystem: false,
    callSystem: false
  };

  try {
    // Test 1: Authentication
    results.authentication = await testAuthentication();
    
    if (!results.authentication) {
      console.log('❌ Authentication failed, skipping other tests');
      return results;
    }

    // Test 2: Socket Connection
    results.socketConnection = await testSocketConnection();
    
    if (!results.socketConnection) {
      console.log('❌ Socket connection failed, skipping chat/call tests');
      return results;
    }

    // Test 3: Chat System
    results.chatSystem = await testChatSystem();

    // Test 4: Call System
    results.callSystem = await testCallSystem();

  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  } finally {
    await cleanup();
  }

  // Print results
  console.log('\n📊 Test Results:');
  console.log('================');
  console.log(`🔐 Authentication: ${results.authentication ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🔌 Socket Connection: ${results.socketConnection ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`💬 Chat System: ${results.chatSystem ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📞 Call System: ${results.callSystem ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(result => result === true);
  console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  return results;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().then(results => {
    process.exit(Object.values(results).every(result => result === true) ? 0 : 1);
  }).catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests };

