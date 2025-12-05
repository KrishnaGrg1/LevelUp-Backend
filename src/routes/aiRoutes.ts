import { Router } from 'express';
import validate from '../middlewares/validation';
import aiValidation from '../validations/aiValidation';
import aiController from '../controllers/aiController';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const aiRoutes = Router();

// AI Chat endpoint (token-protected)
aiRoutes.post('/chat', validate(aiValidation.chat), aiController.chat);

// Quest generation endpoints
aiRoutes.post('/generate/daily', validate(aiValidation.generateTrigger), aiController.generateDailyQuests);
aiRoutes.post('/generate/weekly', validate(aiValidation.generateTrigger), aiController.generateWeeklyQuests);
aiRoutes.post('/generate/daily/force', aiController.forceDailyQuests);
aiRoutes.post('/generate/weekly/force', aiController.forceWeeklyQuests);

// Quest fetch endpoints (user-scoped)
aiRoutes.get('/quests/daily', aiController.getDailyQuests);
aiRoutes.get('/quests/weekly', aiController.getWeeklyQuests);
aiRoutes.get('/quests/completed', validate(aiValidation.completedQuests), aiController.getCompletedQuests);
aiRoutes.get('/quests/:questId', validate(aiValidation.questId), aiController.getSingleQuest);

// Quest actions
aiRoutes.patch('/quests/complete', validate(aiValidation.completeQuest), aiController.completeQuest);
aiRoutes.delete('/quests/:questId', adminMiddleware, validate(aiValidation.questId), aiController.deleteQuest);

// System endpoints
aiRoutes.get('/health', aiController.health);
aiRoutes.get('/config', aiController.config);

export default aiRoutes;
