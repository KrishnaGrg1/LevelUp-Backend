import { Router } from 'express';
import validate from '../middlewares/validation';
import adminController from '../controllers/adminController';
import adminValidation from '../validations/adminValidation';

const adminRoutes = Router();

// ============================================================================
// DASHBOARD & ANALYTICS
// ============================================================================
adminRoutes.get(
  '/overview', 
  adminController.getOverview
);

adminRoutes.get(
  '/user-growth', 
  adminController.getUserGrowth
);

// ============================================================================
// USER MANAGEMENT
// ============================================================================

// List & Search
adminRoutes.get(
  '/users/all', 
  adminController.getAllUsers
);

// Specific User Operations (most specific first)
adminRoutes.delete(
  '/users/delete',
  validate(adminValidation.deleteUser),
  adminController.deleteUser
);

adminRoutes.patch(
  '/users/:id',
  validate(adminValidation.updateDetails),
  adminController.updateUserDetails
);

adminRoutes.get(
  '/users/:id',
  validate(adminValidation.viewUserDetail),
  adminController.viewUserDetail
);

// User Actions (commented out - uncomment when needed)
// adminRoutes.patch('/users/:id/ban', adminController.banUser);
// adminRoutes.patch('/users/:id/unban', adminController.unbanUser);

// ============================================================================
// COMMUNITY MANAGEMENT
// ============================================================================

// Community Stats & List
adminRoutes.get(
  '/communities/stats', 
  adminController.communityStats
);

adminRoutes.get(
  '/communities/all',
  validate(adminValidation.getAllCommunities),
  adminController.getAllCommunities
);

// Community Members
adminRoutes.get(
  '/communities/:communityId/members',
  validate(adminValidation.getAllCommunityMembers),
  adminController.getAllCommunityMembers
);

adminRoutes.delete(
  '/communities/:communityId/members/:memberId',
  validate(adminValidation.removeCommunityMember),
  adminController.removeCommunityMember
);

// Community Settings
adminRoutes.patch(
  '/communities/:communityId/privacy',
  validate(adminValidation.changeCommunityPrivacy),
  adminController.changeCommunityPrivacy
);

adminRoutes.patch(
  '/communities/:communityId/category',
  validate(adminValidation.changeCommunityCategory),
  adminController.changeCommunityCategory
);

// Community CRUD
adminRoutes.put(
  '/communities/:communityId',
  validate(adminValidation.updateCommunityDetails),
  adminController.updateCommunityDetails
);

adminRoutes.delete(
  '/communities/:communityId',
  validate(adminValidation.deleteCommunity),
  adminController.deleteCommunity
);

// ============================================================================
// CATEGORY MANAGEMENT
// ============================================================================
adminRoutes.get(
  '/categories/stats', 
  adminController.categoryStats
);

adminRoutes.post(
  '/communities/addCategory',
  validate(adminValidation.addCategoryForCommunity),
  adminController.addCategoryForCommunity
);

adminRoutes.put(
  '/categories/:oldName',
  validate(adminValidation.editCategoryName),
  adminController.editCategoryName
);

adminRoutes.delete(
  '/categories/:categoryName',
  validate(adminValidation.deleteCategory),
  adminController.deleteCategory
);

// ============================================================================
// TICKET MANAGEMENT
// ============================================================================
adminRoutes.put(
  '/ticket/:id',
  validate(adminValidation.updateTicket),
  adminController.updateTicket
);

export default adminRoutes;
