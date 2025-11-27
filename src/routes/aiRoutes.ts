import { Router } from 'express';
import validate from '../middlewares/validation';
import aiValidation from '../validations/aiValidation';
import aiController from '../controllers/aiController';

const aiRoutes = Router();

// AI Chat endpoint (token-protected)
aiRoutes.post('/chat', validate(aiValidation.chat), aiController.chat);
aiRoutes.post('/generate', validate(aiValidation.generate), aiController.generateQuests);
export default aiRoutes;
