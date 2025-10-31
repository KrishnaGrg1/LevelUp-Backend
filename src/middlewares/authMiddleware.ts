import { Response, NextFunction } from 'express';
import { lucia } from './lucia';
import { TranslationRequest } from './translationMiddleware';
import { makeErrorResponse } from '../helpers/standardResponse';
import { Language } from '../translation/translation';

export interface AuthRequest extends TranslationRequest {
  user?: {
    id: string;
    UserName: string;
    email: string;
    isVerified: boolean;
    xp: number;
    level: number;
    isAdmin: boolean;
  } | null;
  session?: any;
  userID?: { id: string };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  console.log('Cookies:', req.headers.cookie);

  // Try session-based auth first (Lucia)
  const sessionId = lucia.readSessionCookie(req.headers.cookie ?? '');
  const lang = req.language as Language;
  console.log('Session ID from cookie:', sessionId);
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
      } else {
        //session expired and delete from the db
        await lucia.invalidateSession(sessionId);
        res
          .status(403)
          .json(
            makeErrorResponse(
              new Error('Session expired. Please log in again.'),
              'error.auth.session_expired',
              lang,
              403
            )
          );
        return;
      }
    } catch (error) {
      console.error('Session validation error:', error);
    }
  }

  res
    .status(401)
    .json(
      makeErrorResponse(
        new Error('Unauthorized access. Please log in.'),
        'error.auth.unauthorized',
        lang,
        401
      )
    );
  return;
  // No valid auth found
  // req.user = null;
  // req.session = null;
  // req.userID = undefined;
  // next();
};
