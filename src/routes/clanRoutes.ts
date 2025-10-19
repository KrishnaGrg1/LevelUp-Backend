import { Router } from 'express';
import clanController from '../controllers/clanController';
import validate from '../middlewares/validation';
import clanValidation from '../validations/clanValidation';

const clanRoutes = Router();

clanRoutes.post(
  '/create',
  validate(clanValidation.createClan),
  clanController.createClan
);

clanRoutes.post(
  '/join',
  validate(clanValidation.joinClan),
  clanController.joinClan
);

clanRoutes.get(
  '/:communityId',
  validate(clanValidation.getClansByCommunity),
  clanController.getClansByCommunity
);

clanRoutes.delete(
  '/:clanId',
  validate(clanValidation.deleteClan),
  clanController.deleteClan
);

clanRoutes.post(
  '/leave',
  validate(clanValidation.leaveClan),
  clanController.leaveClan
);

clanRoutes.get(
  '/members/:clanId',
  validate(clanValidation.getClanMembers),
  clanController.getClanMembers
);

clanRoutes.get(
  '/info/:clanId',
  validate(clanValidation.getClanInfo),
  clanController.getClanInfo
);

clanRoutes.put(
  '/:clanId',
  validate(clanValidation.updateClan),
  clanController.updateClan
);

clanRoutes.get(
  '/user/:userId',
  validate(clanValidation.getUserClans),
  clanController.getUserClans
);

export default clanRoutes;
