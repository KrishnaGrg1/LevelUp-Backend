import { Router } from 'express';

import messageController from '../controllers/messageController';

const messageRoutes = Router();

// Get community messages (with pagination)
messageRoutes.get(
  '/:communityId/messages',
  messageController.getCommunityMessages
);

// Get community messages (with pagination)
messageRoutes.get(
  '/:communityId/messages',
  messageController.getCommunityMessages
);

// Get clan messages (with pagination)
messageRoutes.get('/clan/:clanId/messages', messageController.getClanMessages);

export default messageRoutes;
