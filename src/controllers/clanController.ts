import { Response } from 'express';
import client from '../helpers/prisma';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Language } from '../translation/translation';
import { findUser } from '../helpers/auth/userHelper';

const generateSlug = (name: string) => {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Create a new Clan inside a Community
 */
const createClan = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const userId = req.user?.id;
    const { name, description, isPrivate, limit, communityId } = req.body;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const user = await findUser(userId, res, lang);
    if (!user) return;

    // Check if user is part of the community
    let member = await client.communityMember.findFirst({
      where: { userId, communityId },
    });

    if (!member) {
      return res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('User is not a member of the community'),
            'error.clan.not_in_community',
            lang,
            403
          )
        );
    }

    // Check for duplicate clan name in the same community
    const existingClan = await client.clan.findFirst({
      where: { name, communityId },
    });

    if (existingClan) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Clan name already exists'),
            'error.clan.clan_name_exists',
            lang,
            400
          )
        );
    }

    // Generate a unique slug
    let slug = generateSlug(name);
    let slugExists = await client.clan.findFirst({ where: { slug } });
    let counter = 1;
    while (slugExists) {
      slug = `${slug}-${counter}`;
      slugExists = await client.clan.findFirst({ where: { slug } });
      counter++;
    }

    // Create clan and assign owner in a transaction
    const clan = await client.$transaction(async (tx) => {
      const newClan = await tx.clan.create({
        data: {
          name,
          slug,
          description,
          isPrivate: isPrivate || false,
          limit: limit || 50,
          xp: 0,
          ownerId: user.id,
          communityId,
          welcomeMessage: 'Welcome to the clan!',
          stats: { memberCount: 1, battlesWon: 0 },
        },
      });

      await tx.communityMember.update({
        where: { id: member!.id },
        data: { clanId: newClan.id, role: 'ADMIN' },
      });

      return newClan;
    });

    console.log(`Clan ${clan.id} created by user ${user.id}`);

    return res
      .status(200)
      .json(makeSuccessResponse(clan, 'success.clan.created', lang, 200));
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    console.error('Failed to create clan:', e);
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to create clan. Try again.'),
          'error.clan.failed_to_create_clan',
          lang,
          500
        )
      );
  }
};

/**
 * Join a Clan
 */
const joinClan = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const userId = req.user?.id;
    const { clanId } = req.body;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const user = await findUser(userId, res, lang);
    if (!user) return;

    const clan = await client.clan.findUnique({
      where: { id: clanId },
      include: { community: true },
    });

    if (!clan) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Clan not found'),
            'error.clan.not_found',
            lang,
            404
          )
        );
    }

    // Find user in community
    const member = await client.communityMember.findFirst({
      where: { userId, communityId: clan.communityId },
    });

    if (!member) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('User must be in community before joining clan'),
            'error.clan.not_in_community',
            lang,
            400
          )
        );
    }

    if (member.clanId) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('User already in a clan'),
            'error.clan.already_in_clan',
            lang,
            400
          )
        );
    }

    // Assign the clan to user's CommunityMember record
    const updated = await client.communityMember.update({
      where: { id: member.id },
      data: { clanId },
    });

    return res
      .status(200)
      .json(makeSuccessResponse(updated, 'success.clan.joined', lang, 200));
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to join clan'),
          'error.clan.failed_to_join',
          lang,
          500
        )
      );
  }
};

/**
 * Leave a Clan
 */
const leaveClan = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const userId = req.user?.id;
    const { clanId } = req.body;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const member = await client.communityMember.findFirst({
      where: { userId, clanId },
    });

    if (!member) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('User not in this clan'),
            'error.clan.not_member',
            lang,
            404
          )
        );
    }

    await client.communityMember.update({
      where: { id: member.id },
      data: { clanId: null, role: 'MEMBER' },
    });

    return res
      .status(200)
      .json(makeSuccessResponse(null, 'success.clan.left', lang, 200));
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to leave clan'),
          'error.clan.failed_to_leave',
          lang,
          500
        )
      );
  }
};

/**
 * Delete a Clan (only by owner)
 */
const deleteClan = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const userId = req.user?.id;
    const { clanId } = req.params;

    const clan = await client.clan.findUnique({ where: { id: clanId } });

    if (!clan)
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Clan not found'),
            'error.clan.not_found',
            lang,
            404
          )
        );

    if (clan.ownerId !== userId) {
      return res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('Only the clan owner can delete this clan'),
            'error.clan.not_owner',
            lang,
            403
          )
        );
    }

    // Detach members first
    await client.communityMember.updateMany({
      where: { clanId: clan.id },
      data: { clanId: null },
    });

    await client.clan.delete({ where: { id: clan.id } });

    return res
      .status(200)
      .json(makeSuccessResponse(null, 'success.clan.deleted', lang, 200));
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to delete clan'),
          'error.clan.failed_to_delete',
          lang,
          500
        )
      );
  }
};

/**
 * Get all Clans in a Community
 */
const getClansByCommunity = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const { communityId } = req.params;

    const clans = await client.clan.findMany({
      where: { communityId },
      include: { owner: true },
    });

    return res
      .status(200)
      .json(makeSuccessResponse(clans, 'success.clan.retrieved', lang, 200));
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch clans'),
          'error.clan.failed_to_fetch',
          lang,
          500
        )
      );
  }
};

/**
 * Get members of a Clan
 */
const getClanMembers = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const { clanId } = req.params;

    // Check if clan exists
    const clan = await client.clan.findUnique({ where: { id: clanId } });
    if (!clan) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Clan not found'),
            'error.clan.clan_not_found',
            lang,
            404
          )
        );
    }

    // Fetch members of the clan
    const members = await client.communityMember.findMany({
      where: { clanId },
      include: { user: true },
    });

    return res
      .status(200)
      .json(
        makeSuccessResponse(
          members,
          'success.clan.members_retrieved',
          lang,
          200
        )
      );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    console.error('Failed to get clan members:', e);
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to get clan members'),
          'error.clan.failed_to_get_members',
          lang,
          500
        )
      );
  }
};

/**
 * Get Clan info (includes slug, welcomeMessage, stats)
 */
const getClanInfo = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const { clanId } = req.params;

    const clan = await client.clan.findUnique({
      where: { id: clanId },
      include: {
        community: true,
        owner: true,
        members: { include: { user: true } },
      },
    });

    if (!clan)
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Clan not found'),
            'error.clan.not_found',
            lang,
            404
          )
        );

    return res
      .status(200)
      .json(makeSuccessResponse(clan, 'success.clan.info', lang, 200));
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to get clan info'),
          'error.clan.failed_to_get_info',
          lang,
          500
        )
      );
  }
};

/**
 * Update Clan info (only owner) — now handles slug
 */
const updateClan = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const userId = req.user?.id;
    const { clanId } = req.params;
    const { name, description, isPrivate, limit } = req.body;

    const clan = await client.clan.findUnique({ where: { id: clanId } });
    if (!clan)
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Clan not found'),
            'error.clan.not_found',
            lang,
            404
          )
        );

    if (clan.ownerId !== userId)
      return res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('Only owner can update this clan'),
            'error.clan.not_owner',
            lang,
            403
          )
        );

    // If name changes, update slug as well
    let slug = clan.slug;
    if (name && name !== clan.name) {
      slug = generateSlug(name);
      let counter = 1;
      while (
        await client.clan.findFirst({ where: { slug, NOT: { id: clanId } } })
      ) {
        slug = `${slug}-${counter}`;
        counter++;
      }
    }

    const updated = await client.clan.update({
      where: { id: clanId },
      data: { name, slug, description, isPrivate, limit },
    });

    return res
      .status(200)
      .json(makeSuccessResponse(updated, 'success.clan.updated', lang, 200));
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    console.error('Failed to update clan:', e);
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to update clan'),
          'error.clan.failed_to_update',
          lang,
          500
        )
      );
  }
};

/**
 * Get all Clans a user is part of
 */
const getUserClans = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const { userId } = req.params;

    // Check if user exists
    const user = await client.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('User not found'),
            'error.clan.user_not_found',
            lang,
            404
          )
        );
    }

    // Fetch all community memberships where user is in a clan
    const clans = await client.communityMember.findMany({
      where: { userId, NOT: { clanId: null } },
      include: { clan: true },
    });

    if (!clans || clans.length === 0) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('No clans found for user'),
            'error.clan.no_user_clans',
            lang,
            404
          )
        );
    }

    return res
      .status(200)
      .json(
        makeSuccessResponse(
          clans,
          'success.clan.user_clans_retrieved',
          lang,
          200
        )
      );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    console.error('Failed to fetch user clans:', e);
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch user clans'),
          'error.clan.failed_to_get_user_clans',
          lang,
          500
        )
      );
  }
};

const clanController = {
  createClan,
  joinClan,
  leaveClan,
  deleteClan,
  getClansByCommunity,
  getClanMembers,
  getClanInfo,
  updateClan,
  getUserClans,
};

export default clanController;
