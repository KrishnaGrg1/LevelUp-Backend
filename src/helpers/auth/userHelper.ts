import { Language } from '../../translation/translation';
import { Response } from 'express';
import client from '../prisma';
import { makeErrorResponse } from '../standardResponse';

export const findUser = async (
  userId: string,
  res: Response,
  lang: Language
) => {
  const user = await client.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    res
      .status(404)
      .json(
        makeErrorResponse(
          new Error('User not found'),
          'error.auth.user_not_found',
          lang,
          404
        )
      );
    return;
  }

  return user;
};
