import { Router } from 'express';
import communityController from '../controllers/communityController';
import validate from '../middlewares/validation';
import communityValidation from '../validations/communityValidation';
import { checkRole } from '../middlewares/roleMiddleware';
import { uploadCommunityPhoto } from '../helpers/multer';

const communityRoutes = Router();

//  Create a community with optional photo upload
communityRoutes.post(
  '/create',
  uploadCommunityPhoto.single('photo'),
  validate(communityValidation.createCommunity),
  communityController.createCommunity
);
//  Get my communities
communityRoutes.get(
  '/my',
  validate(communityValidation.joinCommunity),
  communityController.myCommunities
);

//  Join a community
communityRoutes.post(
  '/:communityId/join',
  validate(communityValidation.joinCommunity),
  communityController.joinCommunity
);

//  Leave a community
communityRoutes.post(
  '/:communityId/leave',
  validate(communityValidation.leaveCommunity),
  communityController.leaveCommunity
);

//  Update community details
communityRoutes.patch(
  '/:communityId',
  validate(communityValidation.updateCommunity),
  communityController.updateCommunity
);

//  Transfer ownership of a community
communityRoutes.post(
  '/:communityId/transfer-ownership',
  validate(communityValidation.transferOwnership),
  communityController.transferOwnership
);

// Remove a member (admin only)
communityRoutes.delete(
  '/:communityId/members/:memberId',
  checkRole(['ADMIN']),
  communityController.removeMember
);

// Change member role (e.g., promote to ADMIN)
communityRoutes.patch(
  '/:communityId/members/:memberId/role',
  checkRole(['ADMIN']),
  communityController.changeMemberRole
);

// Upload community photo (owner or admin only)
communityRoutes.post(
  '/:communityId/upload-photo',
  uploadCommunityPhoto.single('photo'),
  communityController.uploadCommunityPhoto
);

export default communityRoutes;
