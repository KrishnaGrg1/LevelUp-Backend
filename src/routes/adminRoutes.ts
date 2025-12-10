import { Router } from 'express';
import validate from '../middlewares/validation';
import adminController from '../controllers/adminController';
import adminValidation from '../validations/adminValidation';

const adminRoutes = Router();

// ✅ 1. MOST SPECIFIC ROUTES FIRST
adminRoutes.get('/user-growth', adminController.getUserGrowth);
adminRoutes.get('/overview', adminController.getOverview);
adminRoutes.get('/users/all', adminController.getAllUsers);
adminRoutes.get('/communities/all', adminController.getAllCommunities);

//Add Category for Community
adminRoutes.post('/addCategory', adminController.addCategoryForCommunity);
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
