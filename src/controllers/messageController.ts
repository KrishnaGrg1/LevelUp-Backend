import { Response } from 'express';
import client from '../helpers/prisma';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import { AuthRequest } from '../middlewares/authMiddleware';
import {
  checkClanMembership,
  checkCommunityMembership,
} from '../sockets/chatSocket';
import { Language } from '../translation/translation';
const getCommunityMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { communityId } = req.params;
    const lang = req.language as Language;
    const userId = req.user?.id;

    // Validate and sanitize pagination parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    console.log(
      'Fetching messages for communityId:',
      communityId,
      'Page:',
      page,
      'Limit:',
      limit
    );

    if (!userId) {
      res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('User not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
      return;
    }

    //check membership
    const isMember = await checkCommunityMembership(userId, communityId);

    if (!isMember) {
      res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('You are not a member of this community'),
            'error.message.not_a_member',
            lang,
            403
          )
        );
      return;
    }

    //get messages and count in parallel
    const [messages, totalMessages] = await Promise.all([
      client.message.findMany({
        where: {
          communityId,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          sender: {
            select: {
              id: true,
              UserName: true,
              profilePicture: true,
              level: true,
            },
          },
        },
      }),
      client.message.count({
        where: {
          communityId,
        },
      }),
    ]);

    console.log('total messages are', totalMessages);

    // Format messages to match frontend Message interface
    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      createdAt: msg.createdAt,
      communityId: msg.communityId,

      sender: msg.sender,
    }));

    const data = {
      messages: formattedMessages.reverse(), //reverse to chronological order
      pagination: {
        page,
        limit,
        total: totalMessages,
        hasMore: totalMessages > page * limit,
      },
    };

    res
      .status(200)
      .json(makeSuccessResponse(data, 'success.message.fetched', lang, 200));
  } catch (e: unknown) {
    console.error('Error in getCommunityMessages:', e);
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Get community messages failed'),
          'error.message.get_community_messages_failed',
          lang,
          500
        )
      );
  }
};

const getClanMessages = async (req: AuthRequest, res: Response) => {
  const clanId = req.params.clanId;
  const lang = req.language as Language;
  const userId = req.user?.id;
  
  // Validate and sanitize pagination parameters
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  try {
    if (!userId) {
      res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('User not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
      return;
    }

    // Get clan and check membership
    const clan = await client.clan.findUnique({
      where: { id: clanId },
      select: { communityId: true },
    });

    if (!clan) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Clan not found'),
            'error.message.clan_not_found',
            lang,
            404
          )
        );
    }

    console.log('Clan found:', clan);
    console.log('Checking membership for user:', userId);
    console.log('Clan communityId:', clan.communityId);
    console.log('Clan ID:', clanId);
    
    //check clan membership
    const isClanMember = await checkClanMembership(userId, clanId);

    if (!isClanMember) {
      res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('You are not a member of this clan'),
            'error.message.not_a_clan_member',
            lang,
            403
          )
        );
      return;
    }

    //get messages and count with pagination in parallel
    const [message, totalMessages] = await Promise.all([
      client.message.findMany({
        where: {
          clanId: clanId,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          sender: {
            select: {
              id: true,
              UserName: true,
              profilePicture: true,
              level: true,
            },
          },
        },
      }),
      client.message.count({
        where: {
          clanId: clanId,
        },
      }),
    ]);
    
    console.log('message are', message);
    console.log('total messages are', totalMessages);

    //format messages
    const formattedMessages = message.map((msg) => ({
      id: msg.id,
      content: msg.content,
      createdAt: msg.createdAt,
      communityId: msg.communityId,
      clanId: msg.clanId,
      sender: msg.sender,
    }));

    const data = {
      messages: formattedMessages.reverse(), //reverse to chronological order
      pagination: {
        page,
        limit,
        total: totalMessages,
        hasMore: totalMessages > page * limit,
      },
    };
    res
      .status(200)
      .json(makeSuccessResponse(data, 'success.message.fetched', lang, 200));
  } catch (e: unknown) {
    console.error('Error in getClanMessages:', e);
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Get clan messages failed'),
          'error.message.get_clan_messages_failed',
          lang,
          500
        )
      );
  }
};

const messageController = {
  getCommunityMessages,
  getClanMessages,
};

export default messageController;
