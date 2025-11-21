import client from '../helpers/prisma';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import { AuthRequest } from '../middlewares/authMiddleware';
import { checkCommunityMembership } from '../sockets/chatSocket';
import { Language } from '../translation/translation';
import { Response } from 'express';
const getCommunityMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { communityId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const lang = req.language as Language;
    const userId = req.user?.id;

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

    //get messages with pagination
    const messages = await client.message.findMany({
      where: {
        communityId,
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
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
    });

    //get total count
    const totalMessages = await client.message.count({
      where: {
        communityId,
      },
    });

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
        page: Number(page),
        limit: Number(limit),
        total: totalMessages,
        hasMore: totalMessages > Number(page) * Number(limit),
      },
    };

    res
      .status(200)
      .json(makeSuccessResponse(data, 'success.message.fetched', lang, 200));
  } catch (e: unknown) {
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

const messageController = {
  getCommunityMessages,
};

export default messageController;
