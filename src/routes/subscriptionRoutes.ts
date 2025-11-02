import { Router } from 'express';
import validate from '../middlewares/validation';
import subscriptionValidation from '../validations/subscriptionValidation';
import subscriptionController from '../controllers/subscriptionController';

const subscriptionRoutes = Router();

// Subscription management
subscriptionRoutes.get('/', subscriptionController.getMySubscription);
subscriptionRoutes.post(
  '/update',
  validate(subscriptionValidation.updateSubscription),
  subscriptionController.updateSubscription
);
subscriptionRoutes.post(
  '/upgrade',
  validate(subscriptionValidation.upgrade),
  subscriptionController.upgradeSubscription
);

// Streak and tokens
subscriptionRoutes.get('/streak', subscriptionController.getMyStreak);
subscriptionRoutes.get('/tokens', subscriptionController.getMyTokens);

export default subscriptionRoutes;
