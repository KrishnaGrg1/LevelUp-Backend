import { Server } from 'socket.io';
import client from '../helpers/prisma';
import { AuthenticatedSocket } from '../middlewares/socketAuthMiddleware';
import logger from '../helpers/logger';
import {
  checkAuthentication,
  validateMessageContent,
  emitSocketError,
  emitSocketSuccess,
} from '../helpers/socketResponse';

interface JoinCommunityData {
  communityId: string;
}

interface JoinClanData {
  clanId: string;
}

interface SendClanMessageData {
  clanId: string;
  content: string;
}

interface SendCommunityMessageData {
  communityId: string;
  content: string;
}

interface MessagePayload {
  id: string;
  content: string;
  createdAt: Date;
  communityId: string;
  sender: {
    id: string;
    UserName: string;
    profilePicture?: string | null;
    level: number;
  };
}

export async function checkCommunityMembership(
  userId: string,
  communityId: string
): Promise<boolean> {
  const membership = await client.communityMember.findUnique({
    where: {
      userId_communityId: {
        userId,
        communityId,
      },
    },
  });
  return !!membership;
}

export async function checkClanMembership(
  userId: string,

  clanId: string
): Promise<boolean> {
  const membership = await client.clanMember.findUnique({
    where: {
      userId_clanId: {
        userId,
        clanId,
      },
    },
  });
  return !!membership;
}

export default function chatSocketHandler(
  io: Server,
  socket: AuthenticatedSocket
) {
  socket.on('join-community', async (data: JoinCommunityData) => {
    try {
      const { communityId } = data;

      if (!checkAuthentication(socket)) return;

      const isMember = await checkCommunityMembership(
        socket.user.id,
        communityId
      );

      if (!isMember) {
        emitSocketError(socket, 'error', {
          code: 'NOT_MEMBER',
          messageKey: 'error.community.not_member',
        });
        return;
      }

      //join the community room
      socket.join(`community:${communityId}`);
      logger.info('Community joined', {
        username: socket.user.UserName,
        userId: socket.user.id,
        communityId,
      });

      emitSocketSuccess(socket, 'joined-community', {
        messageKey: 'success.community.joined_chat',
        data: { communityId, code: 'JOINED_COMMUNITY_CHAT' },
      });

      socket.to(`community:${communityId}`).emit('user-joined', {
        user: {
          id: socket.user.id,
          UserName: socket.user.UserName,
        },
        timestamp: new Date(),
      });

      const recentMessages = await client.message.findMany({
        where: { communityId },
        orderBy: { createdAt: 'desc' },
        take: 30,
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

      // Format messages to match frontend Message interface
      const formattedMessages = recentMessages.map((msg) => ({
        id: msg.id,
        content: msg.content,
        createdAt: msg.createdAt,
        communityId: msg.communityId,
        senderId: msg.sender.id,
        UserName: msg.sender.UserName,
        sender: msg.sender,
      }));

      socket.emit('recent-messages', {
        communityId,
        messages: formattedMessages.reverse(),
        count: formattedMessages.length,
      });
    } catch (error) {
      logger.error('Error joining community', error, {
        userId: socket.user?.id,
        communityId: data?.communityId,
      });
      emitSocketError(socket, 'error', {
        code: 'COMMUNITY_JOIN_FAILED',
        messageKey: 'error.community.failed_to_join_community',
      });
    }
  });

  socket.on('leave-community', (data: JoinCommunityData) => {
    const { communityId } = data;
    socket.leave(`community:${communityId}`);
    logger.info('Community left', {
      username: socket.user?.UserName,
      userId: socket.user?.id,
      communityId,
    });
    socket.to(`community:${communityId}`).emit('user-left', {
      user: {
        id: socket.user?.id,
        UserName: socket.user?.UserName,
      },
      timeStamp: new Date(),
    });
  });

  socket.on(
    'community:send-message',
    async (data: SendCommunityMessageData) => {
      const { communityId, content } = data;

      logger.debug('📨 Received community:send-message', {
        communityId,
        contentPreview: content?.slice(0, 100),
        userId: socket.user?.id,
      });

      try {
        if (!checkAuthentication(socket)) {
          logger.error('❌ User not authenticated', undefined, {
            socketId: socket.id,
          });
          return;
        }

        if (!validateMessageContent(socket, content)) return;

        const isMember = await checkCommunityMembership(
          socket.user.id,
          communityId
        );
        if (!isMember) {
          emitSocketError(socket, 'error', {
            code: 'NOT_MEMBER',
            messageKey: 'error.community.not_member',
          });
          return;
        }

        const message = await client.message.create({
          data: {
            content: content.trim(),
            senderId: socket.user.id,
            communityId,
          },
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

        const messagePayload = {
          id: message.id,
          content: message.content,
          createdAt: message.createdAt,
          communityId: message.communityId,
          senderId: message.sender.id,
          UserName: message.sender.UserName,
          sender: message.sender,
        };

        //broadcast to all members in the community
        io.to(`community:${communityId}`).emit(
          'community:new-message',
          messagePayload
        );

        logger.info('✅ Message sent to community', {
          username: socket.user.UserName,
          userId: socket.user.id,
          communityId,
          messageId: messagePayload.id,
        });
      } catch (error) {
        logger.error('Error sending community message', error, {
          userId: socket.user?.id,
          communityId,
        });
        emitSocketError(socket, 'error', {
          code: 'MESSAGE_SEND_FAILED',
          messageKey: 'error.message.send_failed',
        });
      }
    }
  );

  socket.on('join-clan', async (data: JoinClanData) => {
    try {
      const { clanId } = data;

      if (!checkAuthentication(socket)) return;

      const isMember = await checkClanMembership(socket.user.id, clanId);

      if (!isMember) {
        emitSocketError(socket, 'clan-access-denied', {
          code: 'NOT_A_MEMBER',
          messageKey: 'error.clan.not_member',
        });
        return;
      }

      socket.join(`clan:${clanId}`);
      logger.info('Clan joined', {
        username: socket.user.UserName,
        userId: socket.user.id,
        clanId,
      });

      emitSocketSuccess(socket, 'joined-clan', {
        messageKey: 'success.clan.joined_chat',
        data: { clanId, code: 'JOINED_CLAN_CHAT' },
      });

      socket.to(`clan:${clanId}`).emit('user-joined', {
        user: {
          id: socket.user.id,
          UserName: socket.user.UserName,
        },
        timestamp: new Date(),
      });

      const recentMessages = await client.message.findMany({
        where: { clanId },
        orderBy: { createdAt: 'desc' },
        take: 30,
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

      // Format messages to match frontend Message interface
      const formattedMessages = recentMessages.map((msg) => ({
        id: msg.id,
        content: msg.content,
        createdAt: msg.createdAt,
        clanId: msg.clanId,
        senderId: msg.sender.id,
        UserName: msg.sender.UserName,
        sender: msg.sender,
      }));
      socket.emit('recent-messages', {
        clanId,
        messages: formattedMessages.reverse(),
        count: formattedMessages.length,
      });
    } catch (error) {
      logger.error('Error joining clan', error, {
        userId: socket.user?.id,
        clanId: data?.clanId,
      });
      emitSocketError(socket, 'error', {
        code: 'CLAN_JOIN_FAILED',
        messageKey: 'error.clan.failed_to_join_clan',
      });
    }
  });
  // send a message to clan
  socket.on('clan:send-message', async (data: SendClanMessageData) => {
    const { clanId, content } = data;

    logger.debug('📨 Received clan:send-message', {
      clanId,
      contentPreview: content?.slice(0, 100),
      userId: socket.user?.id,
    });

    try {
      if (!checkAuthentication(socket)) {
        logger.error('❌ User not authenticated', undefined, {
          socketId: socket.id,
        });
        return;
      }

      if (!validateMessageContent(socket, content)) return;

      const isMember = await checkClanMembership(socket.user.id, clanId);
      if (!isMember) {
        emitSocketError(socket, 'clan-access-denied', {
          code: 'NOT_A_MEMBER',
          messageKey: 'error.clan.not_member',
        });
        return;
      }

      logger.debug('Membership verified for clan message', {
        userId: socket.user.id,
        clanId,
        isMember,
      });

      const message = await client.message.create({
        data: {
          content: content.trim(),
          senderId: socket.user.id,
          clanId,
        },
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

      const messagePayload = {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        clanId: message.clanId,
        senderId: message.sender.id,
        UserName: message.sender.UserName,
        sender: message.sender,
      };

      io.to(`clan:${clanId}`).emit('clan:new-message', messagePayload);

      logger.info('✅ Message sent to clan', {
        username: socket.user.UserName,
        userId: socket.user.id,
        clanId,
        messageId: messagePayload.id,
      });
    } catch (error) {
      logger.error('Error sending clan message', error, {
        userId: socket.user?.id,
        clanId,
      });
      emitSocketError(socket, 'error', {
        code: 'MESSAGE_SEND_FAILED',
        messageKey: 'error.message.send_failed',
      });
    }
  });

  socket.on('leave-clan', (data: JoinClanData) => {
    const { clanId } = data;
    socket.leave(`clan:${clanId}`);
    logger.info('Clan left', {
      username: socket.user?.UserName,
      userId: socket.user?.id,
      clanId,
    });
    socket.to(`clan:${clanId}`).emit('user-left', {
      user: {
        id: socket.user?.id,
        UserName: socket.user?.UserName,
      },
      timeStamp: new Date(),
    });
  });

  //typing indicator
  socket.on('typing', async (data: JoinCommunityData) => {
    const { communityId } = data;

    socket.to(`community:${communityId}`).emit('user-typing', {
      user: {
        id: socket.user?.id,
        UserName: socket.user?.UserName,
      },
      communityId,
    });
  });

  //stop typing indicator
  socket.on('stop-typing', async (data: JoinCommunityData) => {
    const { communityId } = data;

    socket.to(`community:${communityId}`).emit('user-stop-typing', {
      user: {
        id: socket.user?.id,
        UserName: socket.user?.UserName,
      },
      communityId,
    });
  });

  socket.on('disconnect', () => {
    logger.info('Chat socket disconnected', {
      username: socket.user?.UserName,
      userId: socket.user?.id,
      socketId: socket.id,
    });
  });
}
