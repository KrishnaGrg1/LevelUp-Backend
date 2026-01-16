import { Router } from 'express';
import communityController from '../controllers/communityController';
import validate from '../middlewares/validation';
import communityValidation from '../validations/communityValidation';
import { checkRole } from '../middlewares/roleMiddleware';
import { uploadCommunityPhoto } from '../helpers/files/multer';

const communityRoutes = Router();

//  Create a community with optional photo upload
communityRoutes.post(
  '/create',
  uploadCommunityPhoto.single('photo'),
  validate(communityValidation.createCommunity),
  communityController.createCommunity
);

//Get all communities
communityRoutes.get(
  '/',
  validate(communityValidation.getAllCommunities),
  communityController.getAllCommunities
);

//  Get my communities
communityRoutes.get('/my', communityController.myCommunities);

//  Search communities
communityRoutes.get('/search', communityController.searchCommunities);

//  Get specific community details
communityRoutes.get('/:communityId', communityController.specificCommunity);

//  Get community owner (returns { ownerId })
communityRoutes.get(
  '/:communityId/owner',
  validate(communityValidation.getCommunityOwner),
  communityController.getCommunityOwner
);

//  Get community members (members only)
communityRoutes.get(
  '/:communityId/members',
  communityController.getCommunityMembers
);

//  Join public community
communityRoutes.post(
  '/:communityId/join',
  validate(communityValidation.joinPublicCommunity),
  communityController.joinPublicCommunity
);

//  Join private community
communityRoutes.post(
  '/join',
  validate(communityValidation.joinPrivateCommunity),
  communityController.joinPrivateCommunity
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

//toggle pin community for a member
communityRoutes.post(
  '/toggle-pin',
  communityController.toggleMultipleCommunityPin
);

//Get invite code for a community
communityRoutes.get(
  '/:communityId/invite-code',
  validate(communityValidation.getInviteCode),
  communityController.getInviteCode
);

//  Regenerate invite code for a community
communityRoutes.post(
  '/:communityId/regenerate-invite-code',
  communityController.regenerateInviteCode
);

//pin the community
//  Create a community with optional photo upload
// communityRoutes.post(
//   '/:id/pin',

//   communityController.pinCommunity
// );
export default communityRoutes;
