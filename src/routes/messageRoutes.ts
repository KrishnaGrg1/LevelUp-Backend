import { Router } from 'express';

import messageController from '../controllers/messageController';

const messageRoutes = Router();

// Get community messages (with pagination)
messageRoutes.get(
  '/:communityId/messages',
  messageController.getCommunityMessages
);

export default messageRoutes;
