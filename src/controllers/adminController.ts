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

    const { name } = req.body;
    // Check which categories already exist
    const existingCategory = await client.category.findFirst({
      where: {
        name: name,
      },
    });

    // If any exist, return error
    if (existingCategory) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error(`Category already exists: ${name}`),
            'error.admin.category_exists',
            lang,
            400
          )
        );
      return;
    }

    // Create new categories
    const createCategory = await client.category.create({
      data: { name: name },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          { category: createCategory },
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

const communityStats = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;

    const [totalCommunities, privateCommunities, publicCommunities] =
      await Promise.all([
        client.community.count(),
        client.community.count({ where: { isPrivate: true } }),
        client.community.count({ where: { isPrivate: false } }),
      ]);

    res
      .status(200)
      .json(
        makeSuccessResponse(
          { totalCommunities, privateCommunities, publicCommunities },
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

const getAllCommunities = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;

    const lang = (req.language as Language) || 'eng';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const skip = (page - 1) * pageSize;

    const ALLOWED_SORT_FIELDS = ['name', 'createdAt', 'membersCount'];

    //  Sorting
    const sortBy = (req.query.sortBy as string) || 'name';

    let sortField = 'name';
    let sortOrder: 'asc' | 'desc' = 'asc';

    if (sortBy) {
      const isDesc = sortBy.startsWith('-');
      const cleanField = isDesc ? sortBy.substring(1) : sortBy;

      if (ALLOWED_SORT_FIELDS.includes(cleanField)) {
        sortField = cleanField;
        sortOrder = isDesc ? 'desc' : 'asc';
      }
    }

    //Order By
    const orderBy: any = {};
    orderBy[sortField] = sortOrder;

    //Privacy Filter
    const isPrivateQuery = req.query.isPrivate as string | undefined;
    let isPrivateFilter: boolean | undefined = undefined;

    if (isPrivateQuery === 'true') {
      isPrivateFilter = true;
    } else if (isPrivateQuery === 'false') {
      isPrivateFilter = false;
    }

    // Search filter
    const searchQuery = (req.query.search as string) || '';
    const whereFilter: any = {
      ...(isPrivateFilter !== undefined && { isPrivate: isPrivateFilter }),
      ...(searchQuery && {
        OR: [{ name: { contains: searchQuery, mode: 'insensitive' } }],
      }),
    };

    const [communitiesRaw, totalCommunities] = await Promise.all([
      client.community.findMany({
        skip,
        take: pageSize,
        orderBy,
        where: whereFilter,
        include: {
          _count: {
            select: { members: true },
          },
          category: {
            select: {
              name: true,
            },
          },
        },
      }),
      client.community.count({ where: whereFilter }),
    ]);

    const communities = communitiesRaw.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      photo: c.photo,
      isPrivate: c.isPrivate,
      memberLimit: c.memberLimit,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      ownerId: c.ownerId,
      category: c.category?.name || 'No Category',
      membersCount: c._count.members,
    }));

    res.status(200).json(
      makeSuccessResponse(
        {
          communities,
          pagination: {
            total: totalCommunities,
            page,
            pageSize,
            totalPages: Math.ceil(totalCommunities / pageSize),
          },
        },
        'success.admin.retrieved_all_communities',
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
          e instanceof Error ? e : new Error('Failed to fetch all communities'),
          'error.admin.failed_to_fetch_all_communities',
          lang,
          500
        )
      );
    return;
  }
};

const getAllCommunityMembers = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const communityId = req.params.communityId;

    const members = await client.communityMember.findMany({
      where: { communityId },
      include: {
        user: {
          select: {
            id: true,
            UserName: true,
            email: true,
            isAdmin: true,
          },
        },
      },
    });

    const usersOnly = members.map((member) => member.user);
    res.status(200).json(
      makeSuccessResponse(
        {
          members: usersOnly,
        },
        'success.admin.retrieved_all_community_members',
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
          e instanceof Error
            ? e
            : new Error('Failed to fetch community members'),
          'error.admin.failed_to_fetch_community_members',
          lang,
          500
        )
      );
    return;
  }
};

const deleteCommunity = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const communityId = req.params.communityId;

    const community = await client.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Community not found'),
            'error.admin.community_not_found',
            req.language as Language,
            400
          )
        );
      return;
    }

    await client.community.delete({
      where: { id: communityId },
    });

    res.status(200).json(
      makeSuccessResponse(
        {
          communityId: communityId,
          deleted: true,
        },
        'success.admin.deleted_community',
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
          new Error('Failed to delete community'),
          'error.admin.failed_to_delete_community',
          lang,
          500
        )
      );
  }
};

const changeCommunityPrivacy = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const communityId = req.params.communityId;
    const { isPrivate } = req.body;

    if (typeof isPrivate !== 'boolean') {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Invalid value for isPrivate'),
            'error.admin.invalid_privacy_value',
            lang,
            400
          )
        );
    }

    const community = await client.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Community not found'),
            'error.admin.community_not_found',
            req.language as Language,
            404
          )
        );
      return;
    }

    const updatedCommunity = await client.community.update({
      where: { id: communityId },
      data: {
        isPrivate: isPrivate,
      },
      select: {
        id: true,
        name: true,
        isPrivate: true,
        updatedAt: true,
      },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          { updated: true },
          'success.admin.changed_community_privacy',
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
          new Error('Failed to change community privacy'),
          'error.admin.failed_to_change_community_privacy',
          lang,
          500
        )
      );
  }
};

const changeCommunityCategory = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const communityId = req.params.communityId;
    const { category } = req.body;

    const community = await client.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Community not found'),
            'error.admin.community_not_found',
            req.language as Language,
            404
          )
        );
      return;
    }

    const categoryRecord = await client.category.findUnique({
      where: { name: category },
    });
    if (!categoryRecord) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Category  not found'),
            'error.admin.category_not_found',
            req.language as Language,
            404
          )
        );
      return;
    }
    await client.community.update({
      where: { id: communityId },
      data: {
        categoryId: categoryRecord.id,
      },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          { updated: true },
          'success.admin.changed_community_category',
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
          new Error('Failed to change community category'),
          'error.admin.failed_to_change_community_category',
          lang,
          500
        )
      );
  }
};

const removeCommunityMember = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const communityId = req.params.communityId;
    const memberId = req.params.memberId;

    const community = await client.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Community not found'),
            'error.admin.community_not_found',
            req.language as Language,
            404
          )
        );
      return;
    }

    const isMember = await client.communityMember.findFirst({
      where: { communityId, userId: memberId },
    });

    if (!isMember) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Member not found'),
            'error.admin.member_not_found',
            req.language as Language,
            404
          )
        );
      return;
    }

    //remove member from community
    await client.communityMember.delete({
      where: {
        userId_communityId: {
          userId: memberId,
          communityId: communityId,
        },
      },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          community,
          'success.admin.removed_community_member',
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
          new Error('Failed to remove community member'),
          'error.admin.failed_to_remove_community_member',
          lang,
          500
        )
      );
  }
};

const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const encodedName = req.params.categoryName;
    const categoryName = decodeURIComponent(encodedName);

    const category = await client.category.findUnique({
      where: { name: categoryName },
    });

    if (!category) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Category not found'),
            'error.admin.category_not_found',
            req.language as Language,
            400
          )
        );
      return;
    }

    await client.category.delete({
      where: { id: category.id },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          { updated: true },
          'success.admin.deleted_category',
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
          new Error('Failed to delete category'),
          'error.admin.failed_to_delete_category',
          lang,
          500
        )
      );
  }
};

const categoryStats = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;

    // Get all categories with their community counts
    const categories = await client.category.findMany({
      include: {
        _count: {
          select: {
            communities: true,
          },
        },
      },
    });

    // Transform to { categoryName: count } format
    const categoryUsage: Record<string, number> = {};
    categories.forEach((category) => {
      categoryUsage[category.name] = category._count.communities;
    });

    res.status(200).json(
      makeSuccessResponse(
        {
          categoryUsage,
        },
        'success.admin.get_category_overview',
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
          new Error('Failed to get category overview'),
          'error.admin.failed_to_get_category_overview',
          lang,
          500
        )
      );
  }
};

const editCategoryName = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const oldName = req.params.oldName;
    const { name } = req.body;

    const categoryRecord = await client.category.findUnique({
      where: { name: oldName },
    });
    if (!categoryRecord) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Category  not found'),
            'error.admin.category_not_found',
            req.language as Language,
            404
          )
        );
      return;
    }

    //Update the category name
    await client.category.update({
      where: { id: categoryRecord.id },
      data: {
        name: name,
      },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          { updated: true },
          'success.admin.changed_category_name',
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
          new Error('Failed to change category name'),
          'error.admin.failed_to_change_category_name',
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

  deleteUser,
  getOverview,
  getUserGrowth,
  updateTicket,
  addCategoryForCommunity,
  communityStats,
  getAllCommunities,
  getAllCommunityMembers,
  deleteCommunity,
  changeCommunityPrivacy,
  changeCommunityCategory,
  removeCommunityMember,
  deleteCategory,
  categoryStats,
  editCategoryName,
  // banUser,
  // unbanUser,
  // deletePost,
  // deleteComment,
};

export default adminController;
