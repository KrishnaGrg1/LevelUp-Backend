import { Response } from 'express';
import client from '../helpers/prisma';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Language } from '../translation/translation';
import { findUser } from '../helpers/auth/userHelper';

const updateUserDetails = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const userId = req.params.id;
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


    const user=await findUser(userId,res,lang);
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

const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  console.log('Fetching all users with query:', req.query);
  try {
    const lang = (req.language as Language) || 'eng';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const skip = (page - 1) * pageSize;

    const [users, total] = await Promise.all([
      client.user.findMany({
        where: {
          isAdmin: false,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      }),
      client.user.count({
        where: {
          isAdmin: false,
        },
      }),
    ]);

    res.status(200).json(
      makeSuccessResponse(
        {
          users,
          pagination: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
          },
        },
        'success.user.retrieved_all_users',
        lang,
        200
      )
    );
    return;
  }catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          e instanceof Error ? e : new Error('Failed to fetch all  users'),
          'error.auth.failed_to_fetch_all_users',
          lang,
          500
        )
      );
    return;
  }
};


const adminController = {
  updateUserDetails,
  viewUserDetail,
  getAllUsers,
};

export default adminController;
