import { Socket } from 'socket.io';
import { Lucia } from 'lucia';
import { lucia } from './lucia';

export interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    UserName: string;
    email?: string;
    isVerified: boolean;
    xp: number;
    level: number;
    isAdmin: boolean;
  };
}
//socket.IO authentication middleware
export const socketAuthMiddleware = async (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
) => {
  const clientInfo = {
    socketId: socket.id,
    origin: socket.handshake.headers.origin,
    userAgent: socket.handshake.headers['user-agent'],
    transport: socket.conn.transport.name,
  };

  try {
    // 1️⃣ Extract cookies from handshake
    const cookies = socket.handshake.headers.cookie;
    console.log(`🔐 Socket auth attempt:`, {
      ...clientInfo,
      hasCookies: !!cookies,
    });

    if (!cookies) {
      console.warn('❌ Socket auth failed: No cookies provided', clientInfo);
      return next(new Error('Authentication required - no cookies'));
    }
    
    // 2️⃣ Read session cookie
    const sessionId = lucia.readSessionCookie(cookies);

    if (!sessionId) {
      console.warn('❌ Socket auth failed: Invalid session cookie', clientInfo);
      return next(new Error('Invalid session cookie'));
    }
    
    // 3️⃣ Validate session with database
    const { session, user } = await lucia.validateSession(sessionId);
    if (!session || !user) {
      console.warn('❌ Socket auth failed: Session expired or invalid', {
        ...clientInfo,
        sessionId,
      });
      return next(new Error('Session expired or invalid'));
    }
    
    // 4️⃣ Attach user to socket
    socket.user = user;
    
    console.log('✅ Socket auth successful:', {
      ...clientInfo,
      userId: user.id,
      username: user.UserName,
    });
    
    // 5️⃣ Allow connection to proceed
    next(); // ← Success! User authenticated
  } catch (error) {
    console.error('💥 Socket authentication error:', {
      ...clientInfo,
      error: error instanceof Error ? error.message : String(error),
    });
    next(new Error('Authentication failed - server error'));
  }
};
