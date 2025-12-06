import { Server } from 'socket.io';
import {
  AuthenticatedSocket,
  socketAuthMiddleware,
} from '../middlewares/socketAuthMiddleware';
import chatSocketHandler from './chatSocket';
import aiChatSocketHandler from './aiChatSocket';

export default function initializeSocket(io: Server) {
  console.log('🔌 Socket.IO initializing...');

  //apply global authentication middleware
  io.use(socketAuthMiddleware);

  //global connection handler -- WHEN CLIENT CONNECTS
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`✅ Client Connected: ${socket.id} | User: ${socket.user?.UserName} (${socket.user?.id})`);

    // Initialize chat handlers
    chatSocketHandler(io, socket); // Community chat functionality
    aiChatSocketHandler(io, socket); // AI chat functionality

    //global disconnect handler
    socket.on('disconnect', (reason) => {
      console.log(`Client Disconnected: ${socket.id} Reason: ${reason}`);
    });

    //global error handler
    socket.on('error', (error) => {
      console.error('🔴 Socket error:', {
        socketId: socket.id,
        user: socket.user?.UserName,
        error: error.message,
      });
    });
  });

  // Handle connection errors at the server level
  io.engine.on('connection_error', (err) => {
    console.error('Socket.IO connection error:', {
      code: err.code,
      message: err.message,
      context: err.context,
    });
  });

  console.log('✅ Socket.IO server initialized successfully');
  console.log(`📡 Listening for WebSocket connections...`);
}
