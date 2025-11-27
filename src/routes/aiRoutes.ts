import { Router } from 'express';
import validate from '../middlewares/validation';
import aiValidation from '../validations/aiValidation';
import aiController from '../controllers/aiController';

const aiRoutes = Router();

// AI Chat endpoint (token-protected)
aiRoutes.post('/chat', validate(aiValidation.chat), aiController.chat);
aiRoutes.post('/generate', validate(aiValidation.generate), aiController.generateQuests);
aiRoutes.get('/health', aiController.health);
aiRoutes.get('/config', aiController.config);
export default aiRoutes;
