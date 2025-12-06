# 🔌 Socket.IO Connection Issue - SOLUTION

## ❌ Problem Identified

The **frontend is trying to connect to the wrong port**:
- ❌ Current: `ws://localhost:3000/socket.io/`
- ✅ Should be: `ws://localhost:8080/socket.io/`

## 🎯 Solution for Frontend

### 1. Check Environment Variable

Your frontend needs to set `NEXT_PUBLIC_SOCKET_URL` to:
```bash
NEXT_PUBLIC_SOCKET_URL=http://localhost:8080
```

### 2. Frontend Socket Configuration

Update the Socket.IO connection in your frontend:

```typescript
// ❌ WRONG
const socket = io('http://localhost:3000');

// ✅ CORRECT
const socket = io('http://localhost:8080');

// ✅ OR BETTER - Use environment variable
const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8080');
```

## 🔍 Backend Status: ✅ WORKING

The backend is correctly configured:
- ✅ Running on port **8080**
- ✅ Socket.IO initialized with CORS for `http://localhost:3000` (your frontend)
- ✅ Authentication middleware active
- ✅ AI Chat socket handler registered
- ✅ Community chat socket handler registered

## 🧪 Quick Test

### Test 1: Check if Backend is Running
Open in browser: `http://localhost:8080/api/v1/health`

Should return health status.

### Test 2: Test Socket.IO Connection from Browser Console

Open your browser console and run:
```javascript
const socket = io('http://localhost:8080', {
  withCredentials: true,
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('✅ Connected to backend Socket.IO');
});

socket.on('connect_error', (err) => {
  console.error('❌ Connection error:', err.message);
});
```

## 📋 Checklist for Frontend Developer

- [ ] Update `NEXT_PUBLIC_SOCKET_URL` to `http://localhost:8080`
- [ ] Verify Socket.IO client is connecting to `http://localhost:8080`
- [ ] Ensure cookies are being sent (`withCredentials: true`)
- [ ] Check authentication cookie exists before connecting
- [ ] Test connection in browser console

## 🔐 Authentication Requirements

The backend requires:
1. **Valid Lucia session cookie** in the request
2. Cookie must be sent with `credentials: 'include'` or `withCredentials: true`
3. User must be authenticated before Socket.IO connection

## 📝 Example Frontend Socket Service

```typescript
// src/lib/services/socket.ts
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8080';

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
});

export function connectSocket(username: string) {
  if (!socket.connected) {
    socket.connect();
  }
}

export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}
```

## 🚨 Common Errors & Fixes

### Error: "timeout"
**Cause**: Frontend trying to connect to wrong port (3000 instead of 8080)
**Fix**: Update SOCKET_URL to port 8080

### Error: "Authentication required"
**Cause**: No session cookie sent with Socket.IO connection
**Fix**: Ensure `withCredentials: true` and user is logged in

### Error: "Invalid session cookie"
**Cause**: Session expired or invalid
**Fix**: User needs to log in again to get fresh session

### Error: "Session expired"
**Cause**: Database session no longer valid
**Fix**: Implement session refresh or re-login flow

## 📞 Need Help?

Backend logs will show:
```
✅ Socket.IO server initialized successfully
📡 Listening for WebSocket connections...
```

When a client connects successfully:
```
Client Connected: <socket-id>
```

If connection fails, you'll see authentication errors in the backend logs.
