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

const myCommunities = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;

    const userId = req.user?.id; //from session -- logged in user
    console.log('User ID IS', userId);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await findUser(userId as string, res, lang);
    if (!user) return;

    const communities = await client.communityMember.findMany({
      where: { userId: user.id },
      include: { community: true },
    });
    const userCommunities = communities.map((cm) => cm.community);
    res
      .status(200)
      .json(
        makeSuccessResponse(
          userCommunities,
          'success.community.fetched',
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
          new Error('Failed to join community'),
          'error.community.failed_to_join_community',
          lang,
          500
        )
      );
  }
};

const createCommunity = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;

    const userId = req.user?.id; //from session -- logged in user
    console.log('User ID IS', userId);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await findUser(userId as string, res, lang);
    if (!user) return;

    const { communityName, memberLimit, isPrivate } = req.body;

    const communityExists = await client.community.findUnique({
      // check if community name already exists
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
    // create community
    const community = await client.community.create({
      data: {
        name: communityName,
        ownerId: userId,
        memberLimit: memberLimit || 100,
        isPrivate: isPrivate,
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
        makeSuccessResponse(community, 'success.community.created', lang, 200)
      );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to create community'),
          'error.cpmmunity.failed_to_create_community',
          lang,
          500
        )
      );
  }
};

const joinCommunity = async (req: AuthRequest, res: Response) => {
  const communityId = req.params.communityId;
  const lang = req.language as Language;
  const userId = req.user?.id; //from session -- logged in user
  try {
    console.log('User ID IS', userId);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await findUser(userId as string, res, lang);
    if (!user) return;

    const community = await client.community.findUnique({
      // check if community name  exists
      where: { id: communityId },
      include: { members: true },
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
    const alreadyMember = community.members.some((m) => m.userId === user.id);
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
  } catch (e: unknown) {
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

const leaveCommunity = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const userId = req.user?.id;
    const communityId = req.params.communityId;

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
  } catch (e) {
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
  try {
    const lang = req.language as Language;
    const userId = req.user?.id;
    const communityId = req.params.communityId;
    const { newOwnerId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
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
    const isMember = community.members.some((m) => m.userId === newOwnerId);
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

    // Perform ownership transfer
    const updatedCommunity = await client.community.update({
      where: { id: communityId },
      data: { ownerId: newOwnerId },
    });

    // promote new owner to ADMIN role
    await client.communityMember.updateMany({
      where: { communityId, userId: newOwnerId },
      data: { role: 'ADMIN' },
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
  } catch (e) {
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
  const { communityId, name, memberLimit, description, isPrivate } = req.body;
  const userId = req.user?.id;
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
    return;
  } catch (e) {
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

    // Prevent owner from being removed
    if (memberId === community.ownerId) {
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

    // Check if the target user is a member
    const member = community.members.find((m) => m.userId === memberId);
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

    // Remove member
    await client.communityMember.delete({
      where: { id: member.id },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(null, 'success.community.member_removed', lang, 200)
      );
  } catch (e) {
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

    // Prevent changing owner's role
    if (memberId === community.ownerId) {
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

    // Check if target user exists in the community
    const member = community.members.find((m) => m.userId === memberId);
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
  } catch (e) {
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

const communityController = {
  createCommunity,
  joinCommunity,
  myCommunities,
  leaveCommunity,
  transferOwnership,
  updateCommunity,
  removeMember,
  changeMemberRole,
};

export default communityController;
