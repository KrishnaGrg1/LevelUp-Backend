import { Router } from 'express';
import validate from '../middlewares/validation';
import adminController from '../controllers/adminController';
import adminValidation from '../validations/adminValidation';

const adminRoutes = Router();

// ✅ 1. MOST SPECIFIC ROUTES FIRST
adminRoutes.get('/user-growth', adminController.getUserGrowth);

//Admin Overview
adminRoutes.get('/overview', adminController.getOverview);

//Get all users (pagination)
adminRoutes.get('/users/all', adminController.getAllUsers);

// Community Stats
adminRoutes.get('/communities/stats', adminController.communityStats);

// Category Stats
adminRoutes.get('/categories/stats', adminController.categoryStats);

//Get all communities (pagination)
adminRoutes.get('/communities/all', adminController.getAllCommunities);

//Get Communities Members list
adminRoutes.get(
  '/communities/:communityId/members',
  adminController.getAllCommunityMembers
);
//Add Category for Community
adminRoutes.post(
  '/communities/addCategory',
  adminController.addCategoryForCommunity
);

//Edit Category Name
adminRoutes.put('/categories/:oldName', adminController.editCategoryName);

//Delete Community
adminRoutes.delete(
  '/communities/:communityId',
  adminController.deleteCommunity
);

//Delete Category
adminRoutes.delete('/categories/:categoryName', adminController.deleteCategory);

//Remove Community Member
adminRoutes.delete(
  '/communities/:communityId/members/:memberId',
  adminController.removeCommunityMember
);
// Change Community Privacy
adminRoutes.patch(
  '/communities/:communityId/privacy',
  adminController.changeCommunityPrivacy
);

// Change Community Category
adminRoutes.patch(
  '/communities/:communityId/category',
  adminController.changeCommunityCategory
);

// ✅ 2. SPECIFIC PARAMETERIZED ROUTES
adminRoutes.patch(
  '/users/:id',
  validate(adminValidation.updateDetails),
  adminController.updateUserDetails
);

adminRoutes.delete(
  '/users/delete',
  validate(adminValidation.deleteUser),
  adminController.deleteUser
);

adminRoutes.put('/communities/:id', adminController.updateCommunityDetails);

adminRoutes.put(
  '/ticket/:id',
  validate(adminValidation.updateTicket),
  adminController.updateTicket
);

// ✅ 3. GENERIC CATCH-ALL ROUTE LAST
adminRoutes.get('/users/:id', adminController.viewUserDetail); // Changed from '/:id'

// // Ban user
// adminRoutes.patch('/users/:id/ban', adminController.banUser);

// // Unban user
// adminRoutes.patch('/users/:id/unban', adminController.unbanUser);

export default adminRoutes;
