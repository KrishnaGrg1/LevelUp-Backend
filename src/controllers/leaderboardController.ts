import { Request, Response } from 'express';
import client from '../helpers/prisma';
import { makeErrorResponse, makeSuccessResponse } from '../helpers/standardResponse';
import { Language } from '../translation/translation';

/** ------------------
 * Types
 * ------------------ */
interface LocalizedRequest extends Request {
  language?: Language;
}

/** ------------------
 * Utils
 * ------------------ */
const parsePagination = (req: Request) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const buildPagination = (page: number, limit: number, resultsLength: number) => ({
  page,
  limit,
  hasMore: resultsLength === limit,
});

/** ------------------
 * Global Leaderboard
 * ------------------ */
const getGlobalLeaderboard = async (req: LocalizedRequest, res: Response) => {
  try {
    const { page, limit, skip } = parsePagination(req);

    const users = await client.user.findMany({
      orderBy: [{ xp: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        UserName: true,
        profilePicture: true,
        xp: true,
        level: true,
        tokens: true,
      },
      skip,
      take: limit,
    });

    return res.status(200).json(
      makeSuccessResponse(
        {
          results: users,
          pagination: buildPagination(page, limit, users.length),
        },
        'success.leaderboard.global',
        req.language,
        200
      )
    );
  } catch (e) {
    console.error('[Global Leaderboard]', e);
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to fetch global leaderboard'), 'error.leaderboard.global_failed', req.language, 500)
    );
  }
};

/** ------------------
 * Community Leaderboard
 * ------------------ */
const getCommunityLeaderboard = async (req: LocalizedRequest, res: Response) => {
  try {
    const { communityId } = req.params;
    if (!communityId) {
      return res.status(400).json(
        makeErrorResponse(new Error('Community ID is required'), 'error.leaderboard.community_id_required', req.language, 400)
      );
    }

    const { page, limit, skip } = parsePagination(req);

    const community = await client.community.findUnique({
      where: { id: communityId },
      select: { id: true, name: true, xp: true },
    });

    if (!community) {
      return res.status(404).json(
        makeErrorResponse(new Error('Community not found'), 'error.leaderboard.community_not_found', req.language, 404)
      );
    }

    const members = await client.communityMember.findMany({
      where: { communityId },
      orderBy: [{ totalXP: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        totalXP: true,
        level: true,
        user: { select: { id: true, UserName: true, profilePicture: true } },
      },
      skip,
      take: limit,
    });

    return res.status(200).json(
      makeSuccessResponse(
        {
          community,
          results: members,
          pagination: buildPagination(page, limit, members.length),
        },
        'success.leaderboard.community',
        req.language,
        200
      )
    );
  } catch (e) {
    console.error('[Community Leaderboard]', e);
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to fetch community leaderboard'), 'error.leaderboard.community_failed', req.language, 500)
    );
  }
};

/** ------------------
 * Top Communities
 * ------------------ */
const getTopCommunities = async (req: LocalizedRequest, res: Response) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const { sortBy = 'xp', order = 'desc' } = req.query as { sortBy?: string; order?: string };

    const sortField = ['xp', 'memberCount', 'createdAt'].includes(sortBy) ? sortBy : 'xp';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const communities = await client.community.findMany({
      orderBy: { [sortField]: sortOrder },
      select: {
        id: true,
        name: true,
        xp: true,
        memberLimit: true,
        _count: { select: { members: true } },
        createdAt: true,
      },
      skip,
      take: limit,
    });

    return res.status(200).json(
      makeSuccessResponse(
        {
          results: communities,
          sortBy: sortField,
          order: sortOrder,
          pagination: buildPagination(page, limit, communities.length),
        },
        'success.leaderboard.top_communities',
        req.language,
        200
      )
    );
  } catch (e) {
    console.error('[Top Communities]', e);
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to fetch top communities'), 'error.leaderboard.top_communities_failed', req.language, 500)
    );
  }
};

/** ------------------
 * Clan Leaderboard
 * ------------------ */
const getClanLeaderboard = async (req: LocalizedRequest, res: Response) => {
  try {
    const { clanId } = req.params;
    if (!clanId) {
      return res.status(400).json(
        makeErrorResponse(new Error('Clan ID is required'), 'error.leaderboard.clan_id_required', req.language, 400)
      );
    }

    const { page, limit, skip } = parsePagination(req);

    const clan = await client.clan.findUnique({
      where: { id: clanId },
      select: { id: true, name: true, xp: true },
    });

    if (!clan) {
      return res.status(404).json(
        makeErrorResponse(new Error('Clan not found'), 'error.leaderboard.clan_not_found', req.language, 404)
      );
    }

    const members = await client.clanMember.findMany({
      where: { clanId },
      orderBy: [{ totalXP: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        totalXP: true,
        user: { select: { id: true, UserName: true, profilePicture: true } },
      },
      skip,
      take: limit,
    });

    return res.status(200).json(
      makeSuccessResponse(
        {
          clan,
          results: members,
          pagination: buildPagination(page, limit, members.length),
        },
        'success.leaderboard.clan',
        req.language,
        200
      )
    );
  } catch (e) {
    console.error('[Clan Leaderboard]', e);
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to fetch clan leaderboard'), 'error.leaderboard.clan_failed', req.language, 500)
    );
  }
};

/** ------------------
 * Top Clans
 * ------------------ */
const getTopClans = async (req: LocalizedRequest, res: Response) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const { communityId, sortBy = 'xp', order = 'desc' } = req.query as any;

    const sortField = ['xp', 'memberCount', 'createdAt'].includes(sortBy) ? sortBy : 'xp';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const where = communityId ? { communityId } : undefined;

    const clans = await client.clan.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      select: {
        id: true,
        name: true,
        xp: true,
        communityId: true,
        limit: true,
        _count: { select: { members: true } },
        createdAt: true,
      },
      skip,
      take: limit,
    });

    return res.status(200).json(
      makeSuccessResponse(
        {
          results: clans,
          sortBy: sortField,
          order: sortOrder,
          pagination: buildPagination(page, limit, clans.length),
        },
        'success.leaderboard.top_clans',
        req.language,
        200
      )
    );
  } catch (e) {
    console.error('[Top Clans]', e);
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to fetch top clans'), 'error.leaderboard.top_clans_failed', req.language, 500)
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
