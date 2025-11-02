import { Router } from 'express';
import validate from '../middlewares/validation';
import questValidation from '../validations/questValidation';
import questController from '../controllers/questController';

const questRoutes = Router();

// Generate AI quests
questRoutes.post(
  '/generate',
  validate(questValidation.generateQuests),
  questController.generateQuests
);
questRoutes.post(
  '/generate-extra',
  validate(questValidation.generateExtraQuest),
  questController.generateExtraQuest
);

// User quest management
questRoutes.get('/', questController.getMyQuests);
questRoutes.post(
  '/complete',
  validate(questValidation.completeQuest),
  questController.completeQuest
);
questRoutes.post(
  '/create',
  validate(questValidation.createManualQuest),
  questController.createManualQuest
);
questRoutes.delete('/:id', questController.deleteQuest);

export default questRoutes;
