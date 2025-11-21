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
  try {
    // 1️⃣ Extract cookies from handshake
    const cookies = socket.handshake.headers.cookie;

    if (!cookies) {
      return next(new Error('Authentication required'));
    }
    // 2️⃣ Read session cookie
    const sessionId = lucia.readSessionCookie(cookies);

    if (!sessionId) {
      return next(new Error('Invalid session cookie'));
    }
    // 3️⃣ Validate session with database
    const { session, user } = await lucia.validateSession(sessionId);
    if (!session || !user) {
      return next(new Error('Session expired'));
    }
    // 4️⃣ Attach user to socket
    socket.user = user;
    // 5️⃣ Allow connection to proceed
    next(); // ← Success! User authenticated
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};
