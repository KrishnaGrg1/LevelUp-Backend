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

    const user = await findUser(userId, res, lang);
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
  try {
    const user=req.user
    
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
  } catch (e: unknown) {
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

// const banUser = async (req: AuthRequest, res: Response) => {
//   try {
//     const lang = req.language as Language;
//     const userId = req.params.id;
//     const { duration, unit } = req.body;

//     const user = await findUser(userId, res, lang);
//     if (!user) return;

//     let banUntil: Date | null = null;

//     if (unit === 'lifetime') {
//       banUntil = null;
//     } else {
//       const now = new Date();
//       switch (unit) {
//         case 'hours':
//           banUntil = new Date(now.getTime() + duration * 60 * 60 * 1000);
//           break;
//         case 'days':
//           banUntil = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
//           break;
//         case 'months':
//           banUntil = new Date(now);
//           banUntil.setMonth(banUntil.getMonth() + duration);
//           break;
//         default:
//           return res.status(400).json(
//             makeErrorResponse(
//               new Error('Invalid time unit'),
//               'error.admin.invalid_ban_unit',
//               lang,
//               400
//             )
//           );
//       }
//     }

//     const updatedUser = await client.user.update({
//       where: { id: userId },
//       data: {
//         isBanned: true,
//         banUntil,
//       },
//     });

//     res.status(200).json(
//       makeSuccessResponse(
//         updatedUser,
//         'success.admin.user_banned',
//         lang,
//         200
//       )
//     );
//   } catch (e: unknown) {
//     const lang = (req.language as Language) || 'eng';
//     res.status(500).json(
//       makeErrorResponse(
//         e instanceof Error ? e : new Error('Ban user failed'),
//         'error.admin.ban_user_failed',
//         lang,
//         500
//       )
//     );
//   }
// };

// const unbanUser = async (req: AuthRequest, res: Response) => {
//   try {
//     const lang = req.language as Language;
//     const userId = req.params.id;

//     const user = await findUser(userId, res, lang);
//     if (!user) return;

//     const updatedUser = await client.user.update({
//       where: { id: userId },
//       data: {
//         isBanned: false,
//         banUntil: null,
//       },
//     });

//     res.status(200).json(
//       makeSuccessResponse(
//         updatedUser,
//         'success.admin.user_unbanned',
//         lang,
//         200
//       )
//     );
//   } catch (e: unknown) {
//     const lang = (req.language as Language) || 'eng';
//     res.status(500).json(
//       makeErrorResponse(
//         e instanceof Error ? e : new Error('Unban user failed'),
//         'error.admin.unban_user_failed',
//         lang,
//         500
//       )
//     );
//   }
// };


const updateCommunityDetails = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const communityId = req.params.id;
    const { name, description, ownerId } = req.body;
    const updatedCommunity = await client.community.update({
      where: { id: communityId },
      data: { name, description, ownerId },
    });
    res
      .status(200)
      .json(
        makeSuccessResponse(
          updatedCommunity,
          'success.admin.community_updated',
          lang,
          200
        )
      );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res.status(500).json(
      makeErrorResponse(
        e instanceof Error ? e : new Error('Update community failed'),
        'error.admin.update_community_failed',
        lang,
        500
      )
    );
  }
};

const getAllCommunities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const skip = (page - 1) * pageSize;
    const [communities, total] = await Promise.all([
      client.community.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      client.community.count(),
    ]);
    res.status(200)
    .json(
      makeSuccessResponse(
        {
          communities,
          pagination: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
          },
        },
        'success.admin.get_all_communities',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res.status(500).json(
      makeErrorResponse(
        e instanceof Error ? e : new Error('Get all communities failed'),
        'error.admin.get_all_communities_failed',
        lang,
        500
      )
    );
  }
};

const adminController = {
  updateUserDetails,
  viewUserDetail,
  getAllUsers,
  updateCommunityDetails,
  getAllCommunities,
  // banUser,
  // unbanUser,
  // deletePost,
  // deleteComment,
};

export default adminController;
