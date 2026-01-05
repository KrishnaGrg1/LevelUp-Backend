import { Router } from 'express';
import validate from '../middlewares/validation';
import aiValidation from '../validations/aiValidation';
import aiController from '../controllers/aiController';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const aiRoutes = Router();

aiRoutes.post(
    '/chat', 
    validate(aiValidation.chat), aiController.chat);

    aiRoutes.get(
  '/chat/history', validate(aiValidation.chatHistory), aiController.getChatHistory);

  aiRoutes.get(
  '/chat/tokens', aiController.getTokenBalance);

  aiRoutes.delete(
  '/chat/history', validate(aiValidation.deleteChatHistory), aiController.deleteChatHistory);

  aiRoutes.delete(
  '/chat/history/:chatId', validate(aiValidation.chatId), aiController.deleteChatHistory);

  // Quest generation endpoints
aiRoutes.post(
  '/generate/daily', 
  validate(aiValidation.generateTrigger), 
  aiController.generateDailyQuests
);

aiRoutes.post(
  '/generate/weekly', 
  validate(aiValidation.generateTrigger), 
  aiController.generateWeeklyQuests
);

aiRoutes.post(
  '/generate/daily/force', 
  aiController.forceDailyQuests
);

aiRoutes.post(
  '/generate/weekly/force', 
  aiController.forceWeeklyQuests
);

aiRoutes.get(
    '/quests/daily', 
    aiController.getDailyQuests
);

aiRoutes.get(
    '/quests/weekly', 
    aiController.getWeeklyQuests
);

aiRoutes.get(
    '/quests/completed', 
    validate(aiValidation.completedQuests), 
    aiController.getCompletedQuests
);

aiRoutes.get(
    '/quests/:questId', 
    validate(aiValidation.questId), 
    aiController.getSingleQuest
);

aiRoutes.post(
    '/quests/start', 
    validate(aiValidation.startQuest), 
    aiController.startQuest
);

aiRoutes.patch(
    '/quests/complete', 
    validate(aiValidation.completeQuest), 
    aiController.completeQuest
);

aiRoutes.delete(
    '/quests/:questId', 
    adminMiddleware, 
    validate(aiValidation.questId), 
    aiController.deleteQuest
);

aiRoutes.get(
    '/health', 
    aiController.health
);

aiRoutes.get(
    '/config', 
    aiController.config
);

aiRoutes.get(
    '/community/memberships', 
    aiController.getCommunityMemberships
);

aiRoutes.post(
    '/admin/generate/daily/all', 
    adminMiddleware, 
    aiController.adminGenerateDailyAll
);

aiRoutes.post(
    '/admin/generate/daily/:userId', 
    adminMiddleware, 
    aiController.adminGenerateDailyUser
);

aiRoutes.post(
    '/admin/generate/weekly/all', 
    adminMiddleware, 
    aiController.adminGenerateWeeklyAll
);

aiRoutes.post(
    '/admin/generate/weekly/:userId', 
    adminMiddleware, 
    aiController.adminGenerateWeeklyUser
);

aiRoutes.get(
    '/admin/quests/stats', 
    adminMiddleware, 
    aiController.adminGetQuestStats
);

aiRoutes.delete(
    '/admin/quests', 
    adminMiddleware, 
    aiController.adminBulkDeleteQuests
);

export default aiRoutes;
