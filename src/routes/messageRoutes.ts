import { Router } from 'express';
import messageController from '../controllers/messageController';
import validate from '../middlewares/validation';
import messageValidation from '../validations/messageValidation';
const messageRoutes = Router();

// Get community messages (with pagination)
messageRoutes.get(
  '/:communityId/messages',
  validate(messageValidation.getCommunityMessages),
  messageController.getCommunityMessages
);

// Get clan messages (with pagination)
messageRoutes.get(
  '/clan/:clanId/messages',
  validate(messageValidation.getClanMessages),
  messageController.getClanMessages
);

export default messageRoutes;
