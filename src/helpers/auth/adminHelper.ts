import { Response } from 'express';
import { Language } from '../../translation/translation';
import { makeErrorResponse } from '../standardResponse';
import { findUser } from './userHelper';

const authorizeAdmin = async (
  adminId: string | undefined,
  userId: string,
  res: Response,
  lang: Language
) => {
  if (!adminId) {
    res
      .status(401)
      .json(
        makeErrorResponse(
          new Error('Not authenticated'),
          'error.auth.not_authenticated',
          lang,
          401
        )
      );
    return { admin: null, user: null };
  }

  const existingUser = await findUser(userId, res, lang);
  if (!existingUser) return { admin: null, user: null };

  const admin = await findUser(adminId, res, lang);
  if (!admin) return { admin: null, user: null };

  if (admin.isAdmin !== true) {
    res
      .status(403)
      .json(
        makeErrorResponse(
          new Error('Forbidden'),
          'error.admin.forbidden',
          lang,
          403
        )
      );
    return { admin: null, user: null };
  }

  return { admin, user: existingUser };
};

export default authorizeAdmin;
