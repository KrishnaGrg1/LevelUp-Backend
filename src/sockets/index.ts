import { Server } from 'socket.io';
import {
  AuthenticatedSocket,
  socketAuthMiddleware,
} from '../middlewares/socketAuthMiddleware';
import chatSocketHandler from './chatSocket';
import aiChatSocketHandler from './aiChatSocket';
import logger from '../helpers/logger';

export default function initializeSocket(io: Server) {
  logger.info('🔌 Socket.IO initializing...');

  io.use(socketAuthMiddleware);

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info('✅ Client Connected', {
      socketId: socket.id,
      username: socket.user?.UserName,
      userId: socket.user?.id,
    });

    chatSocketHandler(io, socket);
    aiChatSocketHandler(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info('Client Disconnected', { socketId: socket.id, reason });
    });

    socket.on('error', (error) => {
      logger.error('🔴 Socket error', error, {
        socketId: socket.id,
        user: socket.user?.UserName,
      });
    });
  });

  io.engine.on('connection_error', (err) => {
    logger.error('Socket.IO connection error', err, {
      code: err.code,
      message: err.message,
      context: err.context,
    });
  });

  logger.info('✅ Socket.IO server initialized successfully');
  logger.info('📡 Listening for WebSocket connections...');
}
