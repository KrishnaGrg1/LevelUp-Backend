import { Socket } from 'socket.io';
import { Lucia } from 'lucia';
import { lucia } from './lucia';
import logger from '../helpers/logger';

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
    logger.info('🔐 Socket auth attempt', { ...clientInfo, hasCookies: !!cookies });

    if (!cookies) {
      logger.warn('❌ Socket auth failed: No cookies provided', clientInfo);
      return next(new Error('Authentication required - no cookies'));
    }
    
    // 2️⃣ Read session cookie
    const sessionId = lucia.readSessionCookie(cookies);

    if (!sessionId) {
      logger.warn('❌ Socket auth failed: Invalid session cookie', clientInfo);
      return next(new Error('Invalid session cookie'));
    }
    
    // 3️⃣ Validate session with database
    const { session, user } = await lucia.validateSession(sessionId);
    if (!session || !user) {
      logger.warn('❌ Socket auth failed: Session expired or invalid', { ...clientInfo, sessionId });
      return next(new Error('Session expired or invalid'));
    }
    
    // 4️⃣ Attach user to socket
    socket.user = user;
    logger.info('✅ Socket auth successful', { ...clientInfo, userId: user.id, username: user.UserName });
    
    // 5️⃣ Allow connection to proceed
    next(); // ← Success! User authenticated
  } catch (error) {
    logger.error('💥 Socket authentication error', error, { ...clientInfo });
    next(new Error('Authentication failed - server error'));
  }
};
