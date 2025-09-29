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
  try {
    const lang = req.language as Language;

    const userId = req.user?.id; //from session -- logged in user
    console.log('User ID IS', userId);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await findUser(userId as string, res, lang);
    if (!user) return;

    const { communityName } = req.body;

    const community = await client.community.findUnique({
      // check if community name  exists
      where: { name: communityName },
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

const communityController = {
  createCommunity,
  joinCommunity,
};

export default communityController;
