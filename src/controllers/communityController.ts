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

// Get all communities
export const getAllCommunities = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const userId = req.user?.id || undefined;

    // Optional query params: pagination and search
    const queryParams = req.query || {};
   const page = Number(queryParams.page) || 1;   // default to 1
const limit = Number(queryParams.limit) || 20; // default to 20
// sanitize limits
const safePage = Math.max(page, 1);
const safeLimit = Math.min(Math.max(limit, 1), 100);
    const q = typeof queryParams.q === 'string' ? queryParams.q.trim() : undefined;

    const where: any = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    // Build include shape dynamically to add user membership info when logged in
    const include: any = {
      _count: { select: { members: true } },
    };
    if (userId) {
      include.members = {
        where: { userId },
        select: { role: true },
      };
    }

    const [total, communities] = await Promise.all([
      client.community.count({ where }),
      client.community.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
    ]);

    const formattedCommunities = communities.map((community: any) => {
      const membership = userId && Array.isArray(community.members)
        ? community.members[0] || null
        : null;

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
        visibility: community.isPrivate ? 'private' : 'public',
        ...(userId
          ? {
              isMember: Boolean(membership),
              userRole: membership?.role || null,
              isPinned: membership?.isPinned ?? false,
            }
          : {}),
      };
    });

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
  } catch (e: unknown) {
    console.error('Error in getAllCommunities:', e);
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
  try {
    const lang = req.language as Language;

    const userId = req.user?.id; //from session -- logged in user
    console.log('User ID IS', userId);
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
            },
          },
        },
        orderBy: [
          { isPinned: 'desc' },
          { joinedAt: 'desc' },
        ],
      });
    } catch (err: any) {
      // Fallback in case the DB schema hasn't added `isPinned` yet
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === 'P2022' || err.code === 'P2010')
      ) {
        console.warn(
          'myCommunities: falling back order (missing isPinned column or raw query failure):',
          err.message
        );
        communities = await client.communityMember.findMany({
          where: { userId: user.id },
          include: {
            community: {
              include: {
                _count: {
                  select: { members: true },
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
      currentMembers: member.community?._count?.members ?? 0,
      maxMembers: member.community?.memberLimit,
      visibility: member.community?.isPrivate ? 'private' : 'public',
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
  } catch (e: unknown) {
    console.error('Error in myCommunities:', e);
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

const searchCommunities = async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.language as Language;
    const q = req.query.q;

    const userId = req.user?.id; //from session -- logged in user
    console.log('User ID IS', userId);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await findUser(userId as string, res, lang);
    if (!user) return;

    const communities = await client.community.findMany({
      where: {
        name: {
          contains: q as string,
          mode: 'insensitive',
        },
      },
      include: {
        _count: {
          select: { members: true },
        },
      },

      orderBy: { createdAt: 'desc' },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(communities, 'success.community.fetched', lang, 200)
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
  const { communityName, memberLimit, isPrivate, description } = req.body;
  const lang = req.language as Language;

  const userId = req.user?.id; //from session -- logged in user
  console.log('User ID IS', userId);
  try {
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await findUser(userId as string, res, lang);
    if (!user) return;

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

    // Coerce types from multipart/form-data (strings)
    const memberLimitNum = Number(memberLimit) || 100;
    const isPrivateBool = typeof isPrivate === 'boolean'
      ? isPrivate
      : ['true', '1', 'yes', 'on'].includes(String(isPrivate).toLowerCase());
    const descriptionStr = typeof description === 'string' ? description : '';

    // Get photo URL from uploaded file if available (Cloudinary)
    const cloudinaryFile = req.file as any;
    const photoPath = cloudinaryFile
      ? cloudinaryFile.path || cloudinaryFile.url
      : undefined;

    // create community
    const community = await client.community.create({
      data: {
        name: communityName,
        description: descriptionStr,
        ownerId: userId,
        memberLimit: memberLimitNum,
        isPrivate: isPrivateBool,
        photo: photoPath,
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
    console.error('Error in createCommunity:', e);
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
    const isMember = await client.communityMember.findFirst({
      where: { communityId, userId: newOwnerId },
    });
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

    // Demote current owner to MEMBER role
    await client.communityMember.updateMany({
      where: { communityId, userId },
      data: { role: 'MEMBER' },
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

const uploadCommunityPhoto = async (req: AuthRequest, res: Response) => {
  const lang = (req.language as Language) || 'eng';
  const communityId = req.params.communityId;

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
  } catch (error) {
    console.error('Error uploading community photo:', error);
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

  if (!userId) return res.status(401).json({ message: 'Not authenticated' });

  if (!Array.isArray(communityIds))
    return res.status(400).json({ message: 'communityIds must be an array' });

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
    res.status(200).json({
      message: 'Updated pinned communities successfully',
      data: updatedMembers,
    });
  } catch (err) {
    console.error('Toggle pin error:', err);
    res.status(500).json({
      message: 'Failed to update pinned communities',
      error: err,
    });
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

const communityController = {
  createCommunity,
  joinCommunity,
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
};

export default communityController;
