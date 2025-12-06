# Live AI Chat - Socket.IO Implementation Guide

## Overview
Real-time AI chat system with token-based usage (1 token per message). Users start with 50 tokens.

---

## Socket.IO Connection

### Connect to WebSocket
```javascript
import { io } from 'socket.io-client';

const socket = io('YOUR_BACKEND_URL', {
  auth: {
    token: 'YOUR_JWT_TOKEN' // From login
  }
});

socket.on('connect', () => {
  console.log('Connected to AI Chat');
});

socket.on('disconnect', () => {
  console.log('Disconnected from AI Chat');
});
```

---

## Client Events (Emit)

### 1. Check Token Balance
```javascript
// Check if user has tokens before starting chat
socket.emit('ai-chat:check-tokens');
```

### 2. Send AI Chat Message
```javascript
socket.emit('ai-chat:send', {
  prompt: 'Your message here',
  sessionId: 'optional-session-id', // For grouping conversations
  conversationHistory: [ // Optional: for context-aware chat
    { role: 'user', content: 'Previous message' },
    { role: 'assistant', content: 'Previous response' }
  ]
});
```

### 3. Cancel Ongoing Request
```javascript
socket.emit('ai-chat:cancel', {
  sessionId: 'session-id-to-cancel'
});
```

### 4. Get Current Token Balance
```javascript
socket.emit('ai-chat:get-tokens');
```

---

## Server Events (Listen)

### 1. Token Status Response
```javascript
socket.on('ai-chat:token-status', (data) => {
  console.log('Token Status:', data);
  // {
  //   hasTokens: true,
  //   currentTokens: 45,
  //   costPerMessage: 1
  // }
});
```

### 2. Chat Started
```javascript
socket.on('ai-chat:start', (data) => {
  console.log('Chat started:', data);
  // {
  //   sessionId: 'session_1733456789',
  //   timestamp: '2025-12-06T02:46:38.123Z'
  // }
  // Show loading indicator
});
```

### 3. Response Chunks (Streaming)
```javascript
socket.on('ai-chat:chunk', (data) => {
  console.log('Chunk received:', data);
  // {
  //   chunk: 'This is a piece of the response...',
  //   index: 0
  // }
  // Append chunk to UI for streaming effect
});
```

### 4. Chat Complete
```javascript
socket.on('ai-chat:complete', (data) => {
  console.log('Chat complete:', data);
  // {
  //   sessionId: 'session_1733456789',
  //   response: 'Full AI response text',
  //   tokensUsed: 1,
  //   remainingTokens: 44,
  //   responseTime: 2340,
  //   timestamp: '2025-12-06T02:46:40.123Z'
  // }
  // Hide loading, show complete response, update token count
});
```

### 5. Chat Cancelled
```javascript
socket.on('ai-chat:cancelled', (data) => {
  console.log('Chat cancelled:', data);
  // {
  //   sessionId: 'session_1733456789',
  //   timestamp: '2025-12-06T02:46:39.123Z'
  // }
});
```

### 6. Token Balance Update
```javascript
socket.on('ai-chat:tokens', (data) => {
  console.log('Token balance:', data);
  // {
  //   tokens: 45,
  //   timestamp: '2025-12-06T02:46:38.123Z'
  // }
});
```

### 7. Error Handling
```javascript
socket.on('ai-chat:error', (error) => {
  console.error('AI Chat Error:', error);
  // {
  //   code: 'INSUFFICIENT_TOKENS',
  //   message: 'You have run out of tokens',
  //   currentTokens: 0
  // }
  
  // Error codes:
  // - AUTH_ERROR: Not authenticated
  // - INVALID_PROMPT: Empty or invalid prompt
  // - PROMPT_TOO_LONG: Prompt exceeds 4000 characters
  // - AI_NOT_CONFIGURED: AI service unavailable
  // - INSUFFICIENT_TOKENS: No tokens remaining
  // - TOKEN_CHECK_ERROR: Failed to check tokens
  // - TOKEN_FETCH_ERROR: Failed to fetch token balance
  // - CHAT_FAILED: General chat failure
});
```

---

## REST API Endpoints

### 1. Get Chat History
```http
GET /api/ai/chat/history?page=1&limit=20&sessionId=optional
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "chat_123",
        "sessionId": "session_456",
        "prompt": "User's question",
        "response": "AI's answer",
        "tokensUsed": 1,
        "responseTime": 2340,
        "createdAt": "2025-12-06T02:46:38.123Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 85,
      "totalPages": 5,
      "hasMore": true
    }
  }
}
```

### 2. Get Token Balance
```http
GET /api/ai/chat/tokens
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tokens": 45,
    "totalChats": 5,
    "costPerChat": 1
  }
}
```

### 3. Delete Chat History (Single)
```http
DELETE /api/ai/chat/history/:chatId
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deletedChatId": "chat_123"
  }
}
```

### 4. Delete All Chat History
```http
DELETE /api/ai/chat/history?all=true
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deletedCount": 15
  }
}
```

### 5. Regular Chat (Non-Streaming REST)
```http
POST /api/ai/chat
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "prompt": "Your message here"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reply": "AI response text"
  }
}
```

---

## React Example Implementation

```jsx
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

function AIChatComponent({ authToken }) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [tokens, setTokens] = useState(50);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState('');

  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_API_URL, {
      auth: { token: authToken }
    });

    newSocket.on('connect', () => {
      console.log('Connected to AI Chat');
      newSocket.emit('ai-chat:check-tokens');
    });

    newSocket.on('ai-chat:token-status', (data) => {
      setTokens(data.currentTokens);
    });

    newSocket.on('ai-chat:start', () => {
      setIsLoading(true);
      setStreamingResponse('');
    });

    newSocket.on('ai-chat:chunk', (data) => {
      setStreamingResponse(prev => prev + data.chunk);
    });

    newSocket.on('ai-chat:complete', (data) => {
      setIsLoading(false);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.response }
      ]);
      setTokens(data.remainingTokens);
      setStreamingResponse('');
    });

    newSocket.on('ai-chat:error', (error) => {
      setIsLoading(false);
      alert(`Error: ${error.message}`);
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, [authToken]);

  const sendMessage = () => {
    if (!input.trim() || tokens <= 0) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);

    socket.emit('ai-chat:send', {
      prompt: input,
      sessionId: `session_${Date.now()}`
    });

    setInput('');
  };

  return (
    <div>
      <div className="token-count">Tokens: {tokens}</div>
      
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role}>
            {msg.content}
          </div>
        ))}
        {isLoading && streamingResponse && (
          <div className="assistant streaming">
            {streamingResponse}
          </div>
        )}
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        disabled={isLoading || tokens <= 0}
      />
      
      <button onClick={sendMessage} disabled={isLoading || tokens <= 0}>
        Send
      </button>
    </div>
  );
}
```

---

## Features

✅ **Real-time streaming** - See AI response as it's generated  
✅ **Token management** - 1 token per message, starts with 50  
✅ **Chat history** - All conversations saved to database  
✅ **Session support** - Group related conversations  
✅ **Error handling** - Comprehensive error codes  
✅ **Authentication** - JWT-based socket authentication  
✅ **REST API backup** - Non-streaming endpoint available  
✅ **Pagination** - History supports pagination  
✅ **Delete history** - Single or bulk deletion  

---

## Token System

- **Initial Balance**: 50 tokens per user
- **Cost Per Message**: 1 token
- **Deduction**: After successful AI response
- **Check Balance**: Use `ai-chat:get-tokens` or REST endpoint
- **No Refunds**: Tokens deducted even if response is truncated

---

## Best Practices

1. **Check tokens** before showing chat input
2. **Handle errors** gracefully with user-friendly messages
3. **Show loading states** during AI processing
4. **Implement streaming UI** for better UX
5. **Store sessionId** for conversation context
6. **Reconnect** on socket disconnect
7. **Clear sensitive data** on logout
8. **Limit prompt length** to 4000 characters client-side
9. **Debounce** rapid message sending
10. **Cache token balance** to reduce API calls

---

## Security Notes

🔒 All endpoints require authentication  
🔒 Users can only access their own chat history  
🔒 Prompts are moderated before sending to AI  
🔒 Token balance verified before processing  
🔒 Socket connections authenticated via JWT  
