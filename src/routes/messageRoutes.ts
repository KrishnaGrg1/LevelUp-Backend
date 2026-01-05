import { Router } from 'express';

import messageController from '../controllers/messageController';

const messageRoutes = Router();

messageRoutes.get(
  '/:communityId/messages',
  messageController.getCommunityMessages
);

messageRoutes.get('/clan/:clanId/messages', messageController.getClanMessages);

export default messageRoutes;
