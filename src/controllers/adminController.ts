import { Response } from 'express';
import client from '../helpers/prisma';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Language } from '../translation/translation';
import { findUser } from '../helpers/auth/userHelper';
import { startOfMonth, startOfDay, startOfWeek, format } from 'date-fns';

const updateUserDetails = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const userId = req.params.id;
    const { UserName, email, xp, level, isVerified } = req.body;

    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (UserName !== undefined) updateData.UserName = UserName;
    if (xp !== undefined) updateData.xp = xp;
    if (level !== undefined) updateData.level = level;
    if (isVerified !== undefined) updateData.isVerified = isVerified;

    const updatedUser = await client.user.update({
      where: { id: userId },
      data: updateData,
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

const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const userId = req.body.id;

    const user = await client.user.findUnique({
      where: { id: userId },
    });

    const deleteUser = await client.user.delete({
      where: { id: userId },
    });

    res
      .status(200)
      .json(makeSuccessResponse(user, 'success.admin.deleted_user', lang, 200));
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

const getOverview = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const userId = req.user?.id;
    const user = await findUser(userId as string, res, lang);
    if (!user) return; // If user not found, findUser already sent the response
    const [totalUsers, verifiedUsers, adminUsers] = await Promise.all([
      client.user.count(),
      client.user.count({ where: { isVerified: true } }),
      client.user.count({ where: { isAdmin: true } }),
    ]);

    res
      .status(200)
      .json(
        makeSuccessResponse(
          { totalUsers, verifiedUsers, adminUsers },
          'success.admin.get_overview',
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
          new Error('Failed to get overview'),
          'error.admin.failed_to_get_overview',
          lang,
          500
        )
      );
  }
};

const viewUserDetail = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;

    const userId = req.params.id; //from params -- this is user(costumer)

    const user = await findUser(userId, res, lang);
    if (!user) return; // If user not found, findUser already sent the response

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
    const user = req.user;

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
    res
      .status(500)
      .json(
        makeErrorResponse(
          e instanceof Error ? e : new Error('Update community failed'),
          'error.admin.update_community_failed',
          lang,
          500
        )
      );
  }
};

const getAllCommunities = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
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
    res.status(200).json(
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
    res
      .status(500)
      .json(
        makeErrorResponse(
          e instanceof Error ? e : new Error('Get all communities failed'),
          'error.admin.get_all_communities_failed',
          lang,
          500
        )
      );
  }
};

const getUserGrowth = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const range = (req.query.range as string) || 'day';
    //  Define time window
    const now = new Date();
    let startDate: Date;

    switch (range) {
      case 'day':
        startDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 30
        );
        break;
      case 'week':
        startDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 90
        );
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    }

    //  Fetch users created after that date
    const users = await client.user.findMany({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        createdAt: true,
      },
    });

    // Group by the selected range using JS (safe, since dataset is smaller)
    const growthMap: Record<string, number> = {};

    for (const user of users) {
      let key: string;
      const date = new Date(user.createdAt);

      if (range === 'day') {
        key = format(startOfDay(date), 'yyyy-MM-dd');
      } else if (range === 'week') {
        key = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd'); // Monday start
      } else {
        key = format(startOfMonth(date), 'yyyy-MM');
      }

      growthMap[key] = (growthMap[key] || 0) + 1;
    }

    //  Convert map to sorted array
    const growthData = Object.entries(growthMap)
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([period, count]) => ({ period, count }));

    //  Return the analytics data
    res.status(200).json(
      makeSuccessResponse(
        {
          range,
          totalNewUsers: users.length,
          growth: growthData,
        },
        'success.admin.user_growth_fetched',
        lang,
        200
      )
    );
  } catch (e) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          e instanceof Error ? e : new Error('Failed to fetch user growth'),
          'error.admin.user_growth_failed',
          lang,
          500
        )
      );
  }
};

const updateTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lang = req.language as Language;
    const ticketId = req.params.id;
    const { status, priority, expectedDateOfCompletion } = req.body;
    const updatedTicket = await client.ticket.update({
      where: { id: ticketId },
      data: { status, priority, expectedDateOfCompletion },
    });
    res
      .status(200)
      .json(
        makeSuccessResponse(
          updatedTicket,
          'success.admin.updated_ticket',
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
          new Error('Update ticket failed'),
          'error.admin.update_ticket_failed',
          lang,
          500
        )
      );
  }
};

const addCategoryForCommunity = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = req.language as Language;

    // Handle both string and array inputs
    let categoryNamesToCreate: string[] = [];
    if (Array.isArray(req.body.newCategoriesNames)) {
      categoryNamesToCreate = req.body.newCategoriesNames
        .map((name: string) => name.trim())
        .filter(Boolean);
    } else if (typeof req.body.newCategoriesNames === 'string') {
      const trimmed = req.body.newCategoriesNames.trim();
      if (trimmed) {
        categoryNamesToCreate = [trimmed];
      }
    }

    // Validate input
    if (categoryNamesToCreate.length === 0) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('No category names provided'),
            'error.admin.no_category_names',
            lang,
            400
          )
        );
      return;
    }

    // Check which categories already exist
    const existingCategories = await client.category.findMany({
      where: {
        name: {
          in: categoryNamesToCreate,
        },
      },
    });

    // If any exist, return error
    if (existingCategories.length > 0) {
      const existingNames = existingCategories.map((c) => c.name);
      res
        .status(409)
        .json(
          makeErrorResponse(
            new Error(`Category already exists: ${existingNames.join(', ')}`),
            'error.admin.category_exists',
            lang,
            409
          )
        );
      return;
    }

    // Create new categories
    const createCategory = await client.category.createMany({
      data: categoryNamesToCreate.map((name) => ({ name })),
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          { count: createCategory.count, names: categoryNamesToCreate },
          'success.admin.added_category',
          lang,
          200
        )
      );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    console.error('Error adding categories:', e);
    res
      .status(500)
      .json(
        makeErrorResponse(
          e instanceof Error ? e : new Error('Add category failed'),
          'error.admin.added_category_failed',
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
  deleteUser,
  getOverview,
  getUserGrowth,
  updateTicket,
  addCategoryForCommunity,

  // banUser,
  // unbanUser,
  // deletePost,
  // deleteComment,
};

export default adminController;
