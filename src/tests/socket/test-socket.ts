import { io } from 'socket.io-client';

// CONFIGURATION
const SERVER_URL = 'http://localhost:8001';
const TEST_COMMUNITY_ID = 'cmhht40mu0005ui9sayq57elr';
const AUTH_COOKIE = 'auth-session=cwb6ykhojddwgwm46fnmo5gs45utjdudm4e35ses';

console.log('🧪 Testing Socket.IO Chat System\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Create socket connection
const socket = io(SERVER_URL, {
  extraHeaders: { cookie: AUTH_COOKIE },
  transports: ['websocket'],
});

// Timeout handling
let timeoutId = setTimeout(() => {
  console.log('\n⏱️  Test timeout - no joined_community event received');
  console.log('🔌 Disconnecting due to timeout...');
  socket.disconnect();
  process.exit(1);
}, 10000); // 10 seconds

// Log all incoming events for debugging
socket.onAny((eventName, ...args) => {
  console.log(
    `📥 Received event: "${eventName}"`,
    JSON.stringify(args, null, 2)
  );
});

// Step 1: connect
socket.on('connect', () => {
  console.log('✅ STEP 1: Connected to server');
  console.log(`   Socket ID: ${socket.id}`);
  console.log(`   Transport: ${socket.io.engine.transport.name}\n`);

  console.log('📤 STEP 2: Joining community...');
  console.log(`   Community ID: ${TEST_COMMUNITY_ID}`);
  console.log(`   Cookie: ${AUTH_COOKIE.substring(0, 30)}...\n`);

  socket.emit('join_community', { communityId: TEST_COMMUNITY_ID });
});

// Step 2: joined community
socket.on('joined_community', (data) => {
  clearTimeout(timeoutId); // Cancel timeout
  console.log('✅ STEP 3: Successfully joined community');
  console.log('   Data:', JSON.stringify(data, null, 2), '\n');

  console.log('📤 STEP 4: Sending test message...');
  socket.emit('send_message', {
    communityId: TEST_COMMUNITY_ID,
    content: `Test message at ${new Date().toISOString()}`,
  });
});

// Step 3: receive recent messages
socket.on('recent_messages', (data) => {
  console.log('📬 Received recent messages:');
  console.log(`   Count: ${data.count}`);
  if (data.messages.length > 0) {
    console.log('   Latest message:', {
      content: data.messages[data.messages.length - 1].content,
      sender: data.messages[data.messages.length - 1].sender.UserName,
    });
  }
  console.log('');
});

// Step 4: new message broadcast
socket.on('new_message', (message) => {
  console.log('✅ STEP 5: Message received!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📨 Message Details:');
  console.log(`   ID: ${message.id}`);
  console.log(`   Content: ${message.content}`);
  console.log(
    `   Sender: ${message.sender.UserName} (Level ${message.sender.level})`
  );
  console.log(`   Time: ${new Date(message.createdAt).toLocaleString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('🎉 SUCCESS! Socket.IO is working correctly!\n');

  // Step 5: typing simulation
  console.log('📤 Testing typing indicator...');
  socket.emit('typing', { communityId: TEST_COMMUNITY_ID });

  setTimeout(() => {
    socket.emit('stop_typing', { communityId: TEST_COMMUNITY_ID });
    console.log('👋 Disconnecting...\n');
    setTimeout(() => {
      socket.disconnect();
      process.exit(0);
    }, 1000);
  }, 2000);
});

// Typing events
socket.on('user_typing', (data) => {
  console.log(`⌨️  ${data.user.UserName} is typing...`);
});
socket.on('user_stop_typing', (data) => {
  console.log(`⌨️  ${data.user.UserName} stopped typing`);
});

// User join/leave
socket.on('user_joined', (data) => {
  console.log(`👋 ${data.user.UserName} joined the chat`);
});
socket.on('user_left', (data) => {
  console.log(`👋 ${data.user.UserName} left the chat`);
});

// Error handling
socket.on('error', (error) => {
  console.error('❌ Socket Error:', error);
});
socket.on('connect_error', (error) => {
  clearTimeout(timeoutId);
  console.error('❌ Connection Error:', error.message);
  process.exit(1);
});

// Disconnect handling
socket.on('disconnect', (reason) => {
  clearTimeout(timeoutId);
  console.log(`🔌 Disconnected: ${reason}`);
});
