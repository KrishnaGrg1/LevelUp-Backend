import { Server } from 'socket.io';
import client from '../helpers/prisma';
import { AuthenticatedSocket } from '../middlewares/socketAuthMiddleware';
import { count } from 'console';

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

//check if user is a member of a community
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

//check if user is a member of a clan
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

//chat socket handler
export default function chatSocketHandler(
  io: Server,
  socket: AuthenticatedSocket
) {
  //join a community chat room

  //check membership -- join room -- send confirmation -- load recent messages
  socket.on('join-community', async (data: JoinCommunityData) => {
    try {
      const { communityId } = data;

      if (!socket.user) {
        socket.emit('error', { message: 'Not Authenticated' });
        return;
      }

      //check if user is a member of the community
      const isMember = await checkCommunityMembership(
        socket.user.id,
        communityId
      );

      if (!isMember) {
        socket.emit('error', {
          message: 'Access Denied: Not a community member',
        });
        return;
      }

      //join the community room
      socket.join(`community:${communityId}`);
      console.log(`${socket.user.UserName} joined community:${communityId}`);

      //notify user
      socket.emit('joined-community', {
        communityId,
        message: 'Successfully joined community chat',
      });

      //notify other members in the community
      socket.to(`community:${communityId}`).emit('user-joined', {
        user: {
          id: socket.user.id,
          UserName: socket.user.UserName,
        },
        timestamp: new Date(),
      });

      //load recent messages
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
      console.error('Error joining community:', error);
      socket.emit('error', { message: 'Failed to join community' });
    }
  });

  //leave a community room
  socket.on('leave-community', (data: JoinCommunityData) => {
    const { communityId } = data;
    socket.leave(`community:${communityId}`);
    console.log(`${socket.user?.UserName} left community: ${communityId}`);
    socket.to(`community:${communityId}`).emit('user-left', {
      user: {
        id: socket.user?.id,
        UserName: socket.user?.UserName,
      },
      timeStamp: new Date(),
    });
  });

  //send a message to community
  socket.on(
    'community:send-message',
    async (data: SendCommunityMessageData) => {
      const { communityId, content } = data;

      console.log('📨 Received community:send-message:', {
        communityId,
        content,
        userId: socket.user?.id,
      });

      try {
        if (!socket.user) {
          console.error('❌ User not authenticated');
          socket.emit('error', { message: 'Not Authenticated' });
          return;
        }

        if (!content || content.trim().length === 0) {
          socket.emit('error', { message: 'Message cannot be empty.' });
          return;
        }

        if (content.length > 2000) {
          socket.emit('error', {
            message: 'Message too long. Max 2000 characters.',
          });
          return;
        }

        //check membership
        const isMember = await checkCommunityMembership(
          socket.user.id,
          communityId
        );
        if (!isMember) {
          socket.emit('error', {
            message: 'You are not a member of this community',
          });
          return;
        }

        //save message to database
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

        //prepare message payload matching frontend Message interface
        const messagePayload = {
          id: message.id,
          content: message.content,
          createdAt: message.createdAt,
          communityId: message.communityId,
          senderId: message.sender.id,
          UserName: message.sender.UserName,
          sender: message.sender, // Keep for backward compatibility
        };

        //broadcast to all members in the community
        io.to(`community:${communityId}`).emit(
          'community:new-message',
          messagePayload
        );

        console.log(
          `✅ Message sent from ${socket.user.UserName} in community ${communityId}:`,
          messagePayload
        );
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    }
  );

  //check membership -- join room -- send confirmation -- load recent messages
  socket.on('join-clan', async (data: JoinClanData) => {
    try {
      const { clanId } = data;

      if (!socket.user) {
        socket.emit('error', { message: 'Not Authenticated' });
        return;
      }

      //check if user is a member of the community
      const isMember = await checkClanMembership(socket.user.id, clanId);

      if (!isMember) {
        socket.emit('clan-access-denied', {
          code: 'NOT_A_MEMBER',
          message: `Access denied to clan ${clanId}.`,
        });
        return;
      }

      //join the community room
      socket.join(`clan:${clanId}`);
      console.log(`${socket.user.UserName} joined clan kkkkkkkkkk:${clanId}`);

      //notify user
      socket.emit('joined-clan', {
        clanId,
        message: 'Successfully joined clan chat',
      });

      //notify other members in the community
      socket.to(`clan:${clanId}`).emit('user-joined', {
        user: {
          id: socket.user.id,
          UserName: socket.user.UserName,
        },
        timestamp: new Date(),
      });

      //load recent messages
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
      console.error('Error joining clan:', error);
      socket.emit('error', { message: 'Failed to join clan' });
    }
  });
  // send a message to clan
  socket.on('clan:send-message', async (data: SendClanMessageData) => {
    const { clanId, content } = data;

    console.log('📨 Received clan:send-message:', {
      clanId,
      content,
      userId: socket.user?.id,
    });

    try {
      if (!socket.user) {
        console.error('❌ User not authenticated');
        socket.emit('error', { message: 'Not Authenticated' });
        return;
      }

      if (!content || content.trim().length === 0) {
        socket.emit('error', { message: 'Message cannot be empty.' });
        return;
      }

      if (content.length > 2000) {
        socket.emit('error', {
          message: 'Message too long. Max 2000 characters.',
        });
        return;
      }

      //check membership
      const isMember = await checkClanMembership(socket.user.id, clanId);
      if (!isMember) {
        socket.emit('clan-access-denied', {
          code: 'NOT_A_MEMBER',
          message: `Access Denied: You are not a member of clan ${clanId}`,
        });
        return;
      }

      console.log(' Membership verified for user:', socket.user.id, isMember);

      //save message to database
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

      //prepare message payload matching frontend Message interface
      const messagePayload = {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        clanId: message.clanId,
        senderId: message.sender.id,
        UserName: message.sender.UserName,
        sender: message.sender, // Keep for backward compatibility
      };

      //broadcast to all members in the community
      io.to(`clan:${clanId}`).emit('clan:new-message', messagePayload);

      console.log(
        `✅ Message sent from ${socket.user.UserName} in clan ${clanId}:`,
        messagePayload
      );
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  //leave a clan room
  socket.on('leave-clan', (data: JoinClanData) => {
    const { clanId } = data;
    socket.leave(`clan:${clanId}`);
    console.log(`${socket.user?.UserName} left clan: ${clanId}`);
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

  //handle disconnection
  socket.on('disconnect', () => {
    console.log(`${socket.user?.UserName} disconnected from chat socket`);
  });
}
