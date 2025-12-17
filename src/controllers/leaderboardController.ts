import { Request, Response } from 'express';
import client from '../helpers/prisma';
import { makeErrorResponse, makeSuccessResponse } from '../helpers/standardResponse';
import { Language } from '../translation/translation';

const parsePagination = (req: Request) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const getGlobalLeaderboard = async (req: Request, res: Response) => {
  try {
    const lang = (req as any).language as Language;
    const { page, limit, skip } = parsePagination(req);

    const [users, total] = await Promise.all([
      client.user.findMany({
        orderBy: { xp: 'desc' },
        select: { id: true, UserName: true, profilePicture: true, xp: true, level: true, tokens: true },
        skip,
        take: limit,
      }),
      client.user.count(),
    ]);

    return res.status(200).json(
      makeSuccessResponse(
        {
          results: users,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: skip + users.length < total,
          },
        },
        'success.leaderboard.global',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = ((req as any).language as Language) || 'eng';
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to fetch global leaderboard'), 'error.leaderboard.global_failed', lang, 500)
    );
  }
};

const getCommunityLeaderboard = async (req: Request, res: Response) => {
  try {
    const lang = (req as any).language as Language;
    const { communityId } = req.params;
    if (!communityId) {
      return res.status(400).json(
        makeErrorResponse(new Error('Community ID is required'), 'error.leaderboard.community_id_required', lang, 400)
      );
    }

    const { page, limit, skip } = parsePagination(req);

    const community = await client.community.findUnique({ where: { id: communityId } });
    if (!community) {
      return res.status(404).json(
        makeErrorResponse(new Error('Community not found'), 'error.leaderboard.community_not_found', lang, 404)
      );
    }

    const [members, total] = await Promise.all([
      client.communityMember.findMany({
        where: { communityId },
        orderBy: { totalXP: 'desc' },
        select: {
          id: true,
          totalXP: true,
          level: true,
          user: { select: { id: true, UserName: true, profilePicture: true } },
        },
        skip,
        take: limit,
      }),
      client.communityMember.count({ where: { communityId } }),
    ]);

    return res.status(200).json(
      makeSuccessResponse(
        {
          community: { id: community.id, name: community.name, xp: community.xp },
          results: members,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: skip + members.length < total,
          },
        },
        'success.leaderboard.community',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = ((req as any).language as Language) || 'eng';
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to fetch community leaderboard'), 'error.leaderboard.community_failed', lang, 500)
    );
  }
};

const getTopCommunities = async (req: Request, res: Response) => {
  try {
    const lang = (req as any).language as Language;
    const { limit, skip, page } = parsePagination(req);
    const { sortBy = 'xp', order = 'desc' } = req.query as { sortBy?: string; order?: string };

    // Validate sort parameters
    const validSortFields = ['xp', 'members', 'createdAt'];
    const validOrders = ['asc', 'desc'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'xp';
    const sortOrder = validOrders.includes(order) ? order : 'desc';

    // Build orderBy clause based on sortField
    let orderBy: any = { xp: sortOrder };
    if (sortField === 'members') {
      orderBy = { members: { _count: sortOrder } };
    } else if (sortField === 'createdAt') {
      orderBy = { createdAt: sortOrder };
    } else {
      orderBy = { xp: sortOrder };
    }

    const [communities, total] = await Promise.all([
      client.community.findMany({
        orderBy,
        select: { 
          id: true, 
          name: true, 
          xp: true, 
          memberLimit: true, 
          createdAt: true,
          _count: { select: { members: true } }
        },
        skip,
        take: limit,
      }),
      client.community.count(),
    ]);

    const formattedCommunities = communities.map(c => ({
      id: c.id,
      name: c.name,
      xp: c.xp,
      memberLimit: c.memberLimit,
      memberCount: c._count.members,
      createdAt: c.createdAt,
    }));

    return res.status(200).json(
      makeSuccessResponse(
        {
          results: formattedCommunities,
          sortBy: sortField,
          order: sortOrder,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: skip + communities.length < total,
          },
        },
        'success.leaderboard.top_communities',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = ((req as any).language as Language) || 'eng';
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to fetch top communities'), 'error.leaderboard.top_communities_failed', lang, 500)
    );
  }
};

const getClanLeaderboard = async (req: Request, res: Response) => {
  try {
    const lang = (req as any).language as Language;
    const { clanId } = req.params;
    if (!clanId) {
      return res.status(400).json(
        makeErrorResponse(new Error('Clan ID is required'), 'error.leaderboard.clan_id_required', lang, 400)
      );
    }

    const { page, limit, skip } = parsePagination(req);

    const clan = await client.clan.findUnique({ where: { id: clanId } });
    if (!clan) {
      return res.status(404).json(
        makeErrorResponse(new Error('Clan not found'), 'error.leaderboard.clan_not_found', lang, 404)
      );
    }

    const [members, total] = await Promise.all([
      client.clanMember.findMany({
        where: { clanId },
        orderBy: { totalXP: 'desc' },
        select: {
          id: true,
          totalXP: true,
          user: { select: { id: true, UserName: true, profilePicture: true } },
        },
        skip,
        take: limit,
      }),
      client.clanMember.count({ where: { clanId } }),
    ]);

    return res.status(200).json(
      makeSuccessResponse(
        {
          clan: { id: clan.id, name: clan.name, xp: clan.xp },
          results: members,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: skip + members.length < total,
          },
        },
        'success.leaderboard.clan',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = ((req as any).language as Language) || 'eng';
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to fetch clan leaderboard'), 'error.leaderboard.clan_failed', lang, 500)
    );
  }
};

const getTopClans = async (req: Request, res: Response) => {
  try {
    const lang = (req as any).language as Language;
    const { communityId, sortBy = 'xp', order = 'desc' } = req.query as { 
      communityId?: string; 
      sortBy?: string; 
      order?: string; 
    };
    const { page, limit, skip } = parsePagination(req);

    // Validate sort parameters
    const validSortFields = ['xp', 'members', 'createdAt'];
    const validOrders = ['asc', 'desc'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'xp';
    const sortOrder = validOrders.includes(order) ? order : 'desc';

    // Build orderBy clause based on sortField
    let orderBy: any = { xp: sortOrder };
    if (sortField === 'members') {
      orderBy = { members: { _count: sortOrder } };
    } else if (sortField === 'createdAt') {
      orderBy = { createdAt: sortOrder };
    } else {
      orderBy = { xp: sortOrder };
    }

    const where = communityId ? { communityId } : undefined;

    const [clans, total] = await Promise.all([
      client.clan.findMany({
        where,
        orderBy,
        select: { 
          id: true, 
          name: true, 
          xp: true, 
          communityId: true, 
          limit: true, 
          createdAt: true,
          _count: { select: { members: true } }
        },
        skip,
        take: limit,
      }),
      client.clan.count({ where }),
    ]);

    const formattedClans = clans.map(c => ({
      id: c.id,
      name: c.name,
      xp: c.xp,
      communityId: c.communityId,
      limit: c.limit,
      memberCount: c._count.members,
      createdAt: c.createdAt,
    }));

    return res.status(200).json(
      makeSuccessResponse(
        {
          results: formattedClans,
          sortBy: sortField,
          order: sortOrder,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: skip + clans.length < total,
          },
        },
        'success.leaderboard.top_clans',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = ((req as any).language as Language) || 'eng';
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to fetch top clans'), 'error.leaderboard.top_clans_failed', lang, 500)
    );
  }
};

export default {
  getGlobalLeaderboard,
  getCommunityLeaderboard,
  getTopCommunities,
  getClanLeaderboard,
  getTopClans,
};
