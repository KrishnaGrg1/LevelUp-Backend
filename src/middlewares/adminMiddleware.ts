// src/middleware/adminMiddleware.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { makeErrorResponse } from '../helpers/standardResponse';
import { Language } from '../translation/translation';

export const adminMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.user;
  const lang = req.language as Language;
  if (!user || !user.isAdmin) {
    res
      .status(403)
      .json(
        makeErrorResponse(
          new Error('Access denied. Admins only.'),
          'error.auth.admin_only',
          lang,
          403
        )
      );
    return;
  }

  next();
};
