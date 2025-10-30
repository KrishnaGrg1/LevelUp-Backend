import { Router } from 'express';
import validate from '../middlewares/validation';
import authValidation from '../validations/authValidation';
import { authMiddleware } from '../middlewares/authMiddleware';
import adminController from '../controllers/adminController';
import adminValidation from '../validations/adminValidation';

const adminRoutes = Router();
// Example: GET /api/admin/user-growth?range=month
adminRoutes.get('/user-growth', adminController.getUserGrowth);
adminRoutes.get('/overview', adminController.getOverview);
adminRoutes.get('/users/all', adminController.getAllUsers);
adminRoutes.get('/communities/all', adminController.getAllCommunities);
adminRoutes.get('/:id', adminController.viewUserDetail);

adminRoutes.post(
  '/:id',
  validate(adminValidation.updateDetails),
  adminController.updateUserDetails
);

// // Ban user
// adminRoutes.patch('/:id/ban', adminController.banUser);

// // Unban user
// adminRoutes.patch('/:id/unban', adminController.unbanUser);

adminRoutes.put('/communities/:id', adminController.updateCommunityDetails);

adminRoutes.delete(
  '/users/delete',
  validate(adminValidation.deleteUser),
  adminController.deleteUser
);
// adminRoutes.delete('/comments/:id', adminController.deleteComment);

export default adminRoutes;
