import { Router } from 'express';
import validate from '../middlewares/validation';
import { sub } from 'date-fns';
import subscriptionController from '../controllers/subscriptionController';
import subscriptionValidation from '../validations/subscriptionValidation';

const subscriptionRoutes = Router();

subscriptionRoutes.get(
  '/subscriptionPlans',
  subscriptionController.getsubscriptionPlans
);
subscriptionRoutes.post(
  '/addSubscriptionPlan',
  validate(subscriptionValidation.addSubscriptionPlan),
  subscriptionController.addsubscriptionPlan
);

export default subscriptionRoutes;
