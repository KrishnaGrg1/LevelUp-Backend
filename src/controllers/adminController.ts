import { Response } from 'express';
import client from '../helpers/prisma';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Language } from '../translation/translation';
import { findUser } from '../helpers/auth/userHelper';
import authorizeAdmin from '../helpers/auth/adminHelper';

const updateUserDetails = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;

    const adminId = req.user?.id; //from session
    console.log('aMIN ID IS', adminId);

    const userId = req.params.id; //from params -- this is user(costumer)

    const { admin, user } = await authorizeAdmin(adminId, userId, res, lang);
    if (!admin || !user) return;

    const { username } = req.body;

    const updatedUser = await client.user.update({
      where: { id: userId },
      data: { UserName: username },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          updatedUser,
          'success.admin.updated_details',
          lang,
          200
        )
      );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Update user details failed'),
          'error.admin.update_user_details_failed',
          lang,
          500
        )
      );
  }
};

const viewUserDetail = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;

    const adminId = req.user?.id; //from session

    const userId = req.params.id; //from params -- this is user(costumer)

    const { admin, user } = await authorizeAdmin(adminId, userId, res, lang);
    if (!admin || !user) return;

    res
      .status(200)
      .json(
        makeSuccessResponse(user, 'success.admin.view_user_details', lang, 200)
      );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Update user details failed'),
          'error.admin.update_user_details_failed',
          lang,
          500
        )
      );
  }
};

const adminController = {
  updateUserDetails,
  viewUserDetail,
};

export default adminController;
