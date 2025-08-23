import { Request, Response, NextFunction } from 'express';
import { lucia } from './lucia';
import jwt, { JwtPayload } from 'jsonwebtoken';
import env from '../helpers/config';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    UserName: string;
    email: string;
    isVerified: boolean;
    xp: number;
    level: number;
  } | null;
  session?: any;
  userID?: { id: string };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Try session-based auth first (Lucia)
  const sessionId = lucia.readSessionCookie(req.headers.cookie ?? '');

  if (sessionId) {
    try {
      const { session, user } = await lucia.validateSession(sessionId);
      if (session) {
        req.session = session;
        req.user = user;
        req.userID = user ? { id: user.id } : undefined;

        if (session.fresh) {
          res.appendHeader(
            'Set-Cookie',
            lucia.createSessionCookie(session.id).serialize()
          );
        }
        return next();
      }
    } catch (error) {
      console.error('Session validation error:', error);
    }
  }

  // Fallback to JWT auth
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    try {
      const decode = jwt.verify(token, env.JWT_SECRET as string) as {
        userID: number;
      };
      if (typeof decode !== 'string') {
        req.userID = { id: (decode as JwtPayload).userID };
        // You might want to fetch user data from DB here
        return next();
      }
    } catch (error) {
      console.error('JWT validation error:', error);
    }
  }

  // No valid auth found
  req.user = null;
  req.session = null;
  req.userID = undefined;
  next();
};
