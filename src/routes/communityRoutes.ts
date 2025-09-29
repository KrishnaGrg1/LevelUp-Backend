import { Router } from 'express';
import communityController from '../controllers/communityController';
import validate from '../middlewares/validation';
import communityValidation from '../validations/communityValidation';

const communityRoutes = Router();

communityRoutes.post(
  '/create',
  validate(communityValidation.createCommunity),
  communityController.createCommunity
);

communityRoutes.post(
  '/join',
  validate(communityValidation.joinCommunity),
  communityController.joinCommunity
);

export default communityRoutes;
