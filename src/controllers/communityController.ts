import { Response } from 'express';
import { Prisma } from '@prisma/client';
import client from '../helpers/prisma';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Language } from '../translation/translation';
import { findUser } from '../helpers/auth/userHelper';
import authorizeAdmin from '../helpers/auth/adminHelper';
import { deleteFile, extractPublicId } from '../helpers/files/multer';
import { generateCode } from '../helpers/generateCode';
import logger from '../helpers/logger';

// Get all communities (public) with pagination
export const getAllCommunities = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id || undefined;
  logger.apiRequest('GET', '/community', {
    userId,
    action: 'getAllCommunities',
  });

  try {
    const lang = req.language as Language;

    const page = Math.max(1, Number(req.query.page) || 1);
    const rawPageSize = Number(req.query.pageSize) || 20;
    const pageSize = Math.min(Math.max(rawPageSize, 1), 50);

    const communities = await client.community.findMany({
      where: { isPrivate: false },
      include: {
        _count: {
          select: { members: true },
        },
        members: userId
          ? {
              where: { userId },
              select: { role: true, isPinned: true },
            }
          : false,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const formattedCommunities = communities.map((community) => {
      const membership = community.members?.[0];

      return {
        id: community.id,
        name: community.name,
        description: community.description,
        photo: community.photo || null,
        ownerId: community.ownerId,
        categoryId: community.categoryId || null,
        createdAt: community.createdAt,
        updatedAt: community.updatedAt,
        currentMembers: community._count?.members ?? 0,
        maxMembers: community.memberLimit,
        isPrivate: community.isPrivate,
        ...(userId
          ? {
              isMember: Boolean(membership),
              userRole: membership?.role || null,
              isPinned: membership?.isPinned ?? false,
            }
          : {}),
      };
    });

    res.status(200).json(
      makeSuccessResponse(
        formattedCommunities,
        'success.community.fetched',
        lang,
        200,
        {
          'X-Pagination': JSON.stringify({
            page,
            pageSize,
            returned: formattedCommunities.length,
          }),
        }
      )
    );
    logger.apiSuccess('GET', '/community', 200, {
      userId,
      page,
      pageSize,
      count: formattedCommunities.length,
    });
  } catch (e: unknown) {
    logger.apiError('GET', '/community', 500, e, {
      userId,
      action: 'getAllCommunities',
    });
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch communities'),
          'error.community.failed_to_fetch_communities',
          lang,
          500
        )
      );
  }
};

const myCommunities = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  logger.apiRequest('GET', '/community/my', {
    userId,
    action: 'myCommunities',
  });

  try {
    const lang = req.language as Language;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await findUser(userId as string, res, lang);
    if (!user) return;

    let communities;
    try {
      // Prefer ordering by pinned first, then most recently joined
      communities = await client.communityMember.findMany({
        where: { userId: user.id },
        include: {
          community: {
            include: {
              _count: {
                select: { members: true },
              },
              owner: {
                select: { id: true },
              },
            },
          },
        },
        orderBy: [{ isPinned: 'desc' }, { joinedAt: 'desc' }],
      });
    } catch (err: any) {
      // Fallback in case the DB schema hasn't added `isPinned` yet
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === 'P2022' || err.code === 'P2010')
      ) {
        logger.warn(
          'myCommunities: falling back order (missing isPinned column or raw query failure)',
          { error: err.message }
        );
        communities = await client.communityMember.findMany({
          where: { userId: user.id },
          include: {
            community: {
              include: {
                _count: {
                  select: { members: true },
                },
                owner: {
                  select: { id: true },
                },
              },
            },
          },
          orderBy: [{ joinedAt: 'desc' }],
        });
      } else {
        throw err;
      }
    }

    const formattedCommunities = communities.map((member) => ({
      id: member.community?.id,
      name: member.community?.name,
      description: member.community?.description,
      photo: member.community?.photo ?? null,
      ownerId: member.community?.ownerId || member.community?.owner?.id,
      currentMembers: member.community?._count?.members ?? 0,
      maxMembers: member.community?.memberLimit,
      isPrivate: member.community?.isPrivate,
      userRole: member.role,
      isPinned: member.isPinned,
    }));
    res
      .status(200)
      .json(
        makeSuccessResponse(
          formattedCommunities,
          'success.community.fetched',
          lang,
          200
        )
      );
    logger.apiSuccess('GET', '/community/my', 200, {
      userId,
      count: formattedCommunities.length,
    });
  } catch (e: unknown) {
    logger.apiError('GET', '/community/my', 500, e, {
      userId,
      action: 'myCommunities',
    });
    logger.error('Error in myCommunities', e, { userId });
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch my communities'),
          'error.community.failed_to_fetch_my_communities',
          lang,
          500
        )
      );
  }
};

const specificCommunity = async (req: AuthRequest, res: Response) => {
  const lang = req.language as Language;
  const userId = req.user?.id;
  const communityId = req.params.communityId;
  logger.apiRequest('GET', `/community/${communityId}`, {
    userId,
    communityId,
    action: 'specificCommunity',
  });

  try {
    const community = await client.community.findUnique({
      where: { id: communityId },
      select: {
        id: true,
        name: true,
        description: true,
        photo: true,
        isPrivate: true,
        memberLimit: true,
        ownerId: true,
        _count: {
          select: { members: true, clans: true },
        },
      },
    });

    if (!community) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Community not found'),
            'error.community.not_found',
            lang,
            404
          )
        );
    }

    if (community.isPrivate) {
      if (!userId) {
        return res
          .status(401)
          .json(
            makeErrorResponse(
              new Error('Not authenticated'),
              'error.auth.not_authenticated',
              lang,
              401
            )
          );
      }

      const membership = await client.communityMember.findUnique({
        where: {
          userId_communityId: {
            userId,
            communityId: community.id,
          },
        },
      });

      if (!membership) {
        return res
          .status(403)
          .json(
            makeErrorResponse(
              new Error('Access Denied: Not a community member'),
              'error.community.access_denied',
              lang,
              403
            )
          );
      }
    }

    res
      .status(200)
      .json(
        makeSuccessResponse(community, 'success.community.fetched', lang, 200)
      );
    logger.apiSuccess('GET', `/community/${req.params.communityId}`, 200, {
      userId,
      communityId,
    });
  } catch (e: unknown) {
    logger.apiError('GET', `/community/${req.params.communityId}`, 500, e, {
      userId,
      communityId: req.params.communityId,
    });
    logger.error('Error in specificCommunity', e, { userId, communityId });
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch community'),
          'error.community.failed_to_fetch_my_communities',
          lang,
          500
        )
      );
  }
};

const searchCommunities = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const searchQuery = req.query.q;
  logger.apiRequest('GET', '/community/search', {
    userId,
    q: searchQuery,
    action: 'searchCommunities',
  });

  try {
    const lang = req.language as Language;
    const q = (req.query.q as string | undefined)?.trim() || '';

    if (!q) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Search query is required'),
            'error.community.failed_to_fetch_communities',
            lang,
            400
          )
        );
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const rawPageSize = Number(req.query.pageSize) || 20;
    const pageSize = Math.min(Math.max(rawPageSize, 1), 50);

    const communities = await client.community.findMany({
      where: {
        isPrivate: false,
        name: {
          contains: q,
          mode: 'insensitive',
        },
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    res.status(200).json(
      makeSuccessResponse(communities, 'success.community.fetched', lang, 200, {
        'X-Pagination': JSON.stringify({
          page,
          pageSize,
          returned: communities.length,
        }),
      })
    );
    logger.apiSuccess('GET', '/community/search', 200, {
      userId,
      q: searchQuery,
      page,
      pageSize,
      count: communities.length,
    });
  } catch (e: unknown) {
    logger.apiError('GET', '/community/search', 500, e, {
      userId,
      q: searchQuery,
    });
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to search communities'),
          'error.community.failed_to_join_community',
          lang,
          500
        )
      );
  }
};

const createCommunity = async (req: AuthRequest, res: Response) => {
  const { communityName, memberLimit, isPrivate, description } = req.body;
  const lang = req.language as Language;
  const userId = req.user?.id;
  logger.apiRequest('POST', '/community/create', {
    userId,
    communityName,
    isPrivate,
    action: 'createCommunity',
  });
  try {
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await findUser(userId as string, res, lang);
    if (!user) return;

    const communityExists = await client.community.findUnique({
      where: { name: communityName },
    });

    if (communityExists) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Community name already exists'),
            'error.community.community_name_exists',
            lang,
            400
          )
        );
    }

    const memberLimitNumRaw = Number(memberLimit ?? 100);
    const memberLimitNum = Number.isFinite(memberLimitNumRaw)
      ? memberLimitNumRaw
      : 100;

    if (memberLimitNum < 1 || memberLimitNum > 50000) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('memberLimit must be between 1 and 50000'),
            'error.community.failed_to_create_community',
            lang,
            400
          )
        );
    }

    const isPrivateBool =
      typeof isPrivate === 'boolean'
        ? isPrivate
        : ['true', '1', 'yes', 'on'].includes(String(isPrivate).toLowerCase());
    const descriptionStr = typeof description === 'string' ? description : '';

    const cloudinaryFile = req.file as any;
    const photoPath = cloudinaryFile
      ? cloudinaryFile.path || cloudinaryFile.url
      : undefined;

    let rawCode: string | undefined;
    let cleanCode: string | undefined;

    if (isPrivateBool === true) {
      rawCode = generateCode(); // e.g. ABCD-9KX2
      console.log('Generated community join code:', rawCode);
      cleanCode = rawCode.replace(/-/g, ''); // Returns "ZM5KXEKD"
      console.log('Clean community join code:', cleanCode);
    }

    // create community
    const community = await client.community.create({
      data: {
        name: communityName,
        description: descriptionStr,
        ownerId: userId,
        memberLimit: memberLimitNum,
        isPrivate: isPrivateBool,
        photo: photoPath,
        ...(isPrivateBool && cleanCode
          ? {
              joinCodeHash: cleanCode,
              codeUpdatedAt: new Date(),
            }
          : {}),

        members: {
          create: [
            {
              userId: user.id,
              role: 'ADMIN',
            },
          ],
        },
      },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          { id: community.id },
          'success.community.created',
          lang,
          200
        )
      );
  } catch (e: unknown) {
    logger.error('Error in createCommunity', e, { userId });
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to create community'),
          'error.community.failed_to_create_community',
          lang,
          500
        )
      );
  }
};

const joinPublicCommunity = async (req: AuthRequest, res: Response) => {
  const communityId = req.params.communityId;
  const lang = req.language as Language;
  const userId = req.user?.id;
  logger.apiRequest('POST', `/community/${communityId}/join`, {
    userId,
    communityId,
    action: 'joinPublicCommunity',
  });

  try {
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await findUser(userId as string, res, lang);
    if (!user) return;

    const community = await client.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Community name already exists'),
            'error.community.community_not_found',
            lang,
            400
          )
        );
    }

    //check if a user is already a member of the community
    const alreadyMember = await client.communityMember.findFirst({
      where: { communityId: community.id, userId: user.id },
    });
    if (alreadyMember) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('User already a member in this community'),
            'error.community.user_already_in_community',
            lang,
            400
          )
        );
    }

    // join community
    const communityJoin = await client.community.update({
      where: {
        id: community.id,
      },
      data: {
        members: {
          create: [
            {
              userId: user.id,
              role: 'MEMBER',
            },
          ],
        },
      },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          communityJoin,
          'success.community.joined',
          lang,
          200
        )
      );
    logger.apiSuccess(
      'POST',
      `/community/${req.params.communityId}/join`,
      200,
      { userId, communityId: req.params.communityId }
    );
  } catch (e: unknown) {
    logger.apiError(
      'POST',
      `/community/${req.params.communityId}/join`,
      500,
      e,
      { userId, communityId: req.params.communityId }
    );
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to join community'),
          'error.community.failed_to_join_community',
          lang,
          500
        )
      );
  }
};

const joinPrivateCommunity = async (req: AuthRequest, res: Response) => {
  const communityId = req.params.communityId;
  const lang = req.language as Language;
  const joinCode = req.body.joinCode;
  const userId = req.user?.id;
  logger.apiRequest('POST', '/community/join', {
    userId,
    joinCode: joinCode?.substring(0, 4) + '****',
    action: 'joinPrivateCommunity',
  });

  try {
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!joinCode || typeof joinCode !== 'string') {
      return res.status(400).json(
        makeErrorResponse(
          new Error('Join code is required'),
          'error.community.join_code_required',
          lang,

          400
        )
      );
    }

    const user = await findUser(userId as string, res, lang);
    if (!user) return;

    const community = await client.community.findUnique({
      where: { joinCodeHash: joinCode },
    });

    if (!community) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Community not found'),
            'Community Not Found',
            lang,
            400
          )
        );
    }

    //checlk join code
    if (community.joinCodeHash !== joinCode) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Invalid join code'),
            'error.community.invalid_join_code',
            lang,
            400
          )
        );
    }

    //check if a user is already a member of the community
    const alreadyMember = await client.communityMember.findFirst({
      where: { communityId: community.id, userId: user.id },
    });
    if (alreadyMember) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('User already a member in this community'),
            'error.community.user_already_in_community',
            lang,
            400
          )
        );
    }

    // join community
    await client.community.update({
      where: {
        id: community.id,
      },
      data: {
        members: {
          create: [
            {
              userId: user.id,
              role: 'MEMBER',
            },
          ],
        },
      },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          { joined: true },
          'success.community.joined',
          lang,
          200
        )
      );
    logger.apiSuccess('POST', '/community/join', 200, {
      userId,
      communityId: req.params.communityId,
    });
  } catch (e: unknown) {
    logger.apiError('POST', '/community/join', 500, e, { userId });
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to join private community'),
          'error.community.failed_to_join_private_community',
          lang,
          500
        )
      );
  }
};

const leaveCommunity = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const communityId = req.params.communityId;
  logger.apiRequest('POST', `/community/${communityId}/leave`, {
    userId,
    communityId,
    action: 'leaveCommunity',
  });

  try {
    const lang = req.language as Language;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const member = await client.communityMember.findFirst({
      where: { userId, communityId },
    });

    if (!member) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('User not in community'),
            'error.community.not_a_member',
            lang,
            404
          )
        );
    }

    // Check if user is the community owner
    const community = await client.community.findUnique({
      where: { id: communityId },
    });

    if (community?.ownerId === userId) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error(
              'Owner cannot leave their own community unless they transfer ownership'
            ),
            'error.community.owner_cannot_leave',
            lang,
            400
          )
        );
    }

    await client.communityMember.delete({ where: { id: member.id } });

    res.json(makeSuccessResponse(null, 'success.community.left', lang, 200));
    logger.apiSuccess('POST', `/community/${communityId}/leave`, 200, {
      userId,
      communityId,
    });
  } catch (e) {
    logger.apiError('POST', `/community/${communityId}/leave`, 500, e, {
      userId,
      communityId,
    });
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to leave community'),
          'error.community.failed_to_leave',
          lang,
          500
        )
      );
  }
};

const transferOwnership = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const communityId = req.params.communityId;
  const { newOwnerId } = req.body;
  logger.apiRequest('POST', `/community/${communityId}/transfer-ownership`, {
    userId,
    communityId,
    newOwnerId,
    action: 'transferOwnership',
  });

  try {
    const lang = req.language as Language;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Find the community
    const community = await client.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Community not found'),
            'error.community.not_found',
            lang,
            404
          )
        );
    }

    // Check if the logged-in user is the owner
    if (community.ownerId !== userId) {
      return res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('Not authorized to transfer ownership'),
            'error.community.not_owner',
            lang,
            403
          )
        );
    }

    // Check if the target user is a member of the community
    // Support both userId and CommunityMember ID
    let isMember = await client.communityMember.findFirst({
      where: { communityId, userId: newOwnerId },
    });

    // If not found by userId, try finding by CommunityMember ID
    if (!isMember) {
      isMember = await client.communityMember.findFirst({
        where: { communityId, id: newOwnerId },
      });
    }

    if (!isMember) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('New owner must be a member of the community'),
            'error.community.new_owner_not_member',
            lang,
            400
          )
        );
    }

    // Get the actual userId from the member record
    const actualNewOwnerId = isMember.userId;

    // Perform ownership transfer in a transaction
    const updatedCommunity = await client.$transaction(async (tx) => {
      // Update community owner
      const community = await tx.community.update({
        where: { id: communityId },
        data: { ownerId: actualNewOwnerId },
      });

      // Promote new owner to ADMIN role
      await tx.communityMember.updateMany({
        where: { communityId, userId: actualNewOwnerId },
        data: { role: 'ADMIN' },
      });

      // Demote current owner to MEMBER role
      await tx.communityMember.updateMany({
        where: { communityId, userId },
        data: { role: 'MEMBER' },
      });

      return community;
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          updatedCommunity,
          'success.community.ownership_transferred',
          lang,
          200
        )
      );
    logger.apiSuccess(
      'POST',
      `/community/${communityId}/transfer-ownership`,
      200,
      { userId, communityId, newOwnerId: actualNewOwnerId }
    );
  } catch (e) {
    logger.apiError(
      'POST',
      `/community/${communityId}/transfer-ownership`,
      500,
      e,
      { userId, communityId, newOwnerId: req.body.newOwnerId }
    );
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to transfer ownership'),
          'error.community.failed_to_transfer_ownership',
          lang,
          500
        )
      );
  }
};

const updateCommunity = async (req: AuthRequest, res: Response) => {
  const lang = req.language as Language;
  const userId = req.user?.id;
  const communityId = req.params.communityId || req.body.communityId;
  const { name, memberLimit, description, isPrivate } = req.body;
  logger.apiRequest('PATCH', `/community/${communityId}`, {
    userId,
    communityId,
    action: 'updateCommunity',
  });

  try {
    // Check ownership
    const community = await client.community.findUnique({
      where: { id: communityId },
    });
    if (community?.ownerId !== userId) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('User is not the owner of the community'),
            'error.auth.not_owner',
            lang,
            400
          )
        );
      return;
    }

    const updated = await client.community.update({
      where: { id: communityId },
      data: { name, description, memberLimit, isPrivate },
    });

    res.json(
      makeSuccessResponse(updated, 'success.community.updated', lang, 200)
    );
    logger.apiSuccess('PATCH', `/community/${communityId}`, 200, {
      userId,
      communityId,
    });
    return;
  } catch (e) {
    logger.apiError('PATCH', `/community/${communityId}`, 500, e, {
      userId,
      communityId,
    });
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to update community'),
          'error.community.failed_to_update',
          lang,
          500
        )
      );
  }
};

const removeMember = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const userId = req.user?.id;
    const { communityId, memberId } = req.params;
    logger.apiRequest(
      'DELETE',
      `/community/${communityId}/members/${memberId}`,
      { userId, communityId, memberId, action: 'removeMember' }
    );

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Find the community
    const community = await client.community.findUnique({
      where: { id: communityId },
      include: {
        members: true,
      },
    });

    if (!community) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Community not found'),
            'error.community.not_found',
            lang,
            404
          )
        );
    }

    // Check if current user is ADMIN or OWNER in that community
    const requesterMembership = community.members.find(
      (m) => m.userId === userId
    );

    if (
      !requesterMembership ||
      (requesterMembership.role !== 'ADMIN' && community.ownerId !== userId)
    ) {
      return res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('Not authorized to remove members'),
            'error.community.not_authorized',
            lang,
            403
          )
        );
    }

    // Check if the target user is a member
    // memberId can be either the userId or the CommunityMember record ID
    let member = community.members.find((m) => m.userId === memberId);

    // If not found by userId, try to find by CommunityMember ID
    if (!member) {
      member = community.members.find((m) => m.id === memberId);
    }

    if (!member) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('User not found in community'),
            'error.community.member_not_found',
            lang,
            404
          )
        );
    }

    // Prevent owner from being removed
    if (member.userId === community.ownerId) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Cannot remove the community owner'),
            'error.community.cannot_remove_owner',
            lang,
            400
          )
        );
    }

    // Remove member
    await client.communityMember.delete({
      where: { id: member.id },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(null, 'success.community.member_removed', lang, 200)
      );
    logger.apiSuccess(
      'DELETE',
      `/community/${req.params.communityId}/members/${req.params.memberId}`,
      200,
      {
        userId: req.user?.id,
        communityId: req.params.communityId,
        memberId: req.params.memberId,
      }
    );
  } catch (e) {
    logger.apiError(
      'DELETE',
      `/community/${req.params.communityId}/members/${req.params.memberId}`,
      500,
      e,
      {
        userId: req.user?.id,
        communityId: req.params.communityId,
        memberId: req.params.memberId,
      }
    );
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to remove member'),
          'error.community.failed_to_remove_member',
          lang,
          500
        )
      );
  }
};

const changeMemberRole = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const userId = req.user?.id;
    const { communityId, memberId } = req.params;
    const { role } = req.body; // expected: 'ADMIN' | 'MEMBER'
    logger.apiRequest(
      'PATCH',
      `/community/${communityId}/members/${memberId}/role`,
      {
        userId,
        communityId,
        memberId,
        newRole: role,
        action: 'changeMemberRole',
      }
    );

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Validate role
    if (!['ADMIN', 'MEMBER'].includes(role)) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Invalid role'),
            'error.community.invalid_role',
            lang,
            400
          )
        );
    }

    // Find the community
    const community = await client.community.findUnique({
      where: { id: communityId },
      include: { members: true },
    });

    if (!community) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Community not found'),
            'error.community.not_found',
            lang,
            404
          )
        );
    }

    // Check if current user is owner or admin
    const requesterMembership = community.members.find(
      (m) => m.userId === userId
    );

    if (
      !requesterMembership ||
      (requesterMembership.role !== 'ADMIN' && community.ownerId !== userId)
    ) {
      return res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('Not authorized to change roles'),
            'error.community.not_authorized',
            lang,
            403
          )
        );
    }

    // Check if target user exists in the community
    // Support both userId and CommunityMember ID for flexibility
    let member = community.members.find((m) => m.userId === memberId);
    if (!member) {
      // Fallback: try to find by CommunityMember record ID
      member = community.members.find((m) => m.id === memberId);
    }

    if (!member) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Member not found'),
            'error.community.member_not_found',
            lang,
            404
          )
        );
    }

    // Prevent changing owner's role (check after finding member)
    if (member.userId === community.ownerId) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Cannot change owner role'),
            'error.community.cannot_change_owner_role',
            lang,
            400
          )
        );
    }

    // Update member role
    const updatedMember = await client.communityMember.update({
      where: { id: member.id },
      data: { role },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          updatedMember,
          'success.community.role_changed',
          lang,
          200
        )
      );
    logger.apiSuccess(
      'PATCH',
      `/community/${req.params.communityId}/members/${req.params.memberId}/role`,
      200,
      {
        userId: req.user?.id,
        communityId: req.params.communityId,
        memberId: req.params.memberId,
        newRole: req.body.role,
      }
    );
  } catch (e) {
    logger.apiError(
      'PATCH',
      `/community/${req.params.communityId}/members/${req.params.memberId}/role`,
      500,
      e,
      {
        userId: req.user?.id,
        communityId: req.params.communityId,
        memberId: req.params.memberId,
      }
    );
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to change member role'),
          'error.community.failed_to_change_role',
          lang,
          500
        )
      );
  }
};

const uploadCommunityPhoto = async (req: AuthRequest, res: Response) => {
  const lang = (req.language as Language) || 'eng';
  const communityId = req.params.communityId;
  logger.apiRequest('POST', `/community/${communityId}/upload-photo`, {
    userId: req.user?.id,
    communityId,
    action: 'uploadCommunityPhoto',
  });

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
    }

    if (!req.file) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('No file uploaded'),
            'error.upload.no_file',
            lang,
            400
          )
        );
    }

    const user = await findUser(userId as string, res, lang);
    if (!user) return;

    // Check if community exists and user is owner or admin
    const community = await client.community.findUnique({
      where: { id: communityId },
      include: {
        members: true,
      },
    });

    if (!community) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Community not found'),
            'error.community.community_not_found',
            lang,
            404
          )
        );
    }

    // Check if user is owner or admin of the community
    const member = community.members.find((m) => m.userId === user.id);
    if (!member || (member.role !== 'ADMIN' && community.ownerId !== user.id)) {
      return res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('Only community owner or admin can upload photo'),
            'error.community.not_authorized',
            lang,
            403
          )
        );
    }

    // Delete old photo if it exists (from Cloudinary)
    if (community.photo) {
      const publicId = extractPublicId(community.photo);
      if (publicId) {
        await deleteFile(publicId);
      }
    }

    // Get Cloudinary URL from uploaded file
    const cloudinaryFile = req.file as any;
    const photoUrl = cloudinaryFile.path || cloudinaryFile.url;

    if (!photoUrl) {
      return res
        .status(500)
        .json(
          makeErrorResponse(
            new Error('Failed to get Cloudinary URL'),
            'error.upload.failed_to_upload',
            lang,
            500
          )
        );
    }

    // Update community with new photo URL (Cloudinary)
    const updatedCommunity = await client.community.update({
      where: { id: communityId },
      data: {
        photo: photoUrl,
      },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          { photo: updatedCommunity.photo },
          'success.upload.community_photo_uploaded',
          lang,
          200
        )
      );
    logger.apiSuccess(
      'POST',
      `/community/${req.params.communityId}/upload-photo`,
      200,
      { userId: req.user?.id, communityId: req.params.communityId }
    );
  } catch (error) {
    logger.apiError(
      'POST',
      `/community/${req.params.communityId}/upload-photo`,
      500,
      error,
      { userId: req.user?.id, communityId: req.params.communityId }
    );
    logger.error('Error uploading community photo', error, {
      userId: req.user?.id,
      communityId,
    });
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to upload community photo'),
          'error.upload.failed_to_upload',
          lang,
          500
        )
      );
  }
};
const toggleMultipleCommunityPin = async (req: AuthRequest, res: Response) => {
  const { communityIds } = req.body; // array of IDs to pin
  const userId = req.user?.id;
  const lang = (req.headers['accept-language'] as Language) || 'eng';
  logger.apiRequest('POST', '/community/toggle-pin', {
    userId,
    communityIds,
    action: 'toggleMultipleCommunityPin',
  });

  if (!userId) {
    return res
      .status(401)
      .json(
        makeErrorResponse(
          new Error('Not authenticated'),
          'error.auth.not_authenticated',
          lang,
          401
        )
      );
  }

  if (!Array.isArray(communityIds)) {
    return res
      .status(400)
      .json(
        makeErrorResponse(
          new Error('Community IDs must be an array'),
          'error.community.invalid_community_ids',
          lang,
          400
        )
      );
  }

  try {
    // Get all the user's communities
    const userMemberships = await client.communityMember.findMany({
      where: { userId },
      select: { id: true, communityId: true, isPinned: true },
    });

    const updates = await Promise.all(
      userMemberships.map(async (member) => {
        const shouldBePinned = communityIds.includes(member.communityId);
        if (member.isPinned !== shouldBePinned) {
          return client.communityMember.update({
            where: { id: member.id },
            data: { isPinned: shouldBePinned },
          });
        }
        return member;
      })
    );
    const updatedMembers = updates.map((u) => ({
      communityId: u.communityId,
      isPinned: u.isPinned,
    }));
    res
      .status(200)
      .json(
        makeSuccessResponse(
          { data: updatedMembers },
          'success.community.pinned_updated',
          lang,
          200
        )
      );
    logger.apiSuccess('POST', '/community/toggle-pin', 200, {
      userId,
      count: updatedMembers.length,
    });
  } catch (err) {
    logger.apiError('POST', '/community/toggle-pin', 500, err, {
      userId,
      communityIds: req.body.communityIds,
    });
    logger.error('Toggle pin error', err, { userId, communityIds });
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to update pinned communities'),
          'error.community.failed_to_update_community',
          lang,
          500
        )
      );
  }
};

// //pin the community
// const pinCommunity = async (req: AuthRequest, res: Response) => {
//   try {
//     const userId = req.user?.id;
//     const { id: communityId } = req.params;
//     const lang = req.language as Language;

//     if (!userId) {
//       return res.status(401).json({ error: 'Not authenticated' });
//     }

//     // Update the CommunityMember record for this user and community
//     const updated = await client.communityMember.updateMany({
//       where: {
//         userId: userId,
//         communityId: communityId,
//       },
//       data: { isPinned: true },
//     });

//     if (updated.count === 0) {
//       return res.status(404).json({
//         error: 'Community membership not found',
//       });
//     }

//     res
//       .status(200)
//       .json(
//         makeSuccessResponse(updated, 'success.community.pinned', lang, 200)
//       );
//   } catch (e: unknown) {
//     const lang = (req.language as Language) || 'eng';
//     return res
//       .status(500)
//       .json(
//         makeErrorResponse(
//           new Error('Failed to pin community'),
//           'error.community.failed_to_pin',
//           lang,
//           500
//         )
//       );
//   }
// };

// // Unpin the communnity
// const unpinCommunity = async (req: AuthRequest, res: Response) => {
//   try {
//     const userId = req.user?.id;
//     const { id: communityId } = req.params;
//     const lang = req.language as Language;

//     if (!userId) {
//       return res.status(401).json({ error: 'Not authenticated' });
//     }

//     const updated = await client.communityMember.updateMany({
//       where: {
//         userId: userId,
//         communityId: communityId,
//       },
//       data: { isPinned: false },
//     });

//     if (updated.count === 0) {
//       return res.status(404).json({
//         error: 'Community membership not found',
//       });
//     }

//     return res.json({
//       message: 'Community unpinned successfully',
//     });
//   } catch (e: unknown) {
//     const lang = (req.language as Language) || 'eng';
//     return res
//       .status(500)
//       .json(
//         makeErrorResponse(
//           new Error('Failed to unpin community'),
//           'error.community.failed_to_unpin',
//           lang,
//           500
//         )
//       );
//   }
// };

// Get community members
const getCommunityMembers = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const communityId = req.params.communityId;
  logger.apiRequest('GET', `/community/${communityId}/members`, {
    userId,
    communityId,
    action: 'getCommunityMembers',
  });

  try {
    const lang = req.language as Language;

    if (!userId) {
      return res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
    }

    // Check if user is a member of the community
    const membership = await client.communityMember.findUnique({
      where: {
        userId_communityId: {
          userId,
          communityId,
        },
      },
    });

    if (!membership) {
      return res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('Not a member of this community'),
            'error.community.not_member',
            lang,
            403
          )
        );
    }

    // Fetch all members
    const members = await client.communityMember.findMany({
      where: { communityId },
      include: {
        user: {
          select: {
            id: true,
            UserName: true,
            profilePicture: true,
            level: true,
            xp: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const formattedMembers = members.map((member) => ({
      id: member.id,
      userId: member.user.id,
      userName: member.user.UserName,
      profilePicture: member.user.profilePicture,
      level: member.user.level,
      xp: member.user.xp,
      role: member.role,
      isPinned: member.isPinned,
      joinedAt: member.joinedAt,
    }));

    res
      .status(200)
      .json(
        makeSuccessResponse(
          { members: formattedMembers, count: formattedMembers.length },
          'success.community.members_retrieved',
          lang,
          200
        )
      );
    logger.apiSuccess('GET', `/community/${communityId}/members`, 200, {
      userId,
      communityId,
      count: formattedMembers.length,
    });
  } catch (e: unknown) {
    logger.apiError('GET', `/community/${communityId}/members`, 500, e, {
      userId,
      communityId,
    });
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch community members'),
          'error.community.failed_to_fetch_members',
          lang,
          500
        )
      );
  }
};

// Return only the ownerId for a community
const getCommunityOwner = async (req: AuthRequest, res: Response) => {
  try {
    const communityId = req.params.communityId;
    if (!communityId) {
      return res.status(400).json({ error: 'Community ID is required' });
    }

    const community = await client.community.findUnique({
      where: { id: communityId },
      select: { ownerId: true },
    });

    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }

    return res.status(200).json({ ownerId: community.ownerId });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch owner' });
  }
};

const communityController = {
  createCommunity,
  joinPublicCommunity,
  joinPrivateCommunity,
  myCommunities,
  getAllCommunities,
  leaveCommunity,
  transferOwnership,
  updateCommunity,
  removeMember,
  changeMemberRole,
  uploadCommunityPhoto,
  toggleMultipleCommunityPin,
  // unpinCommunity,
  searchCommunities,
  specificCommunity,
  getCommunityOwner,
  getCommunityMembers,
};

export default communityController;
