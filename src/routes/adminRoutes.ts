import { Router } from 'express';
import validate from '../middlewares/validation';
import authValidation from '../validations/authValidation';
import { authMiddleware } from '../middlewares/authMiddleware';
import adminController from '../controllers/adminController';
import adminValidation from '../validations/adminValidation';

const adminRoutes = Router();

adminRoutes.post(
  '/:id',
  validate(adminValidation.updateDetails),
  adminController.updateUserDetails
);
adminRoutes.get('/:id', adminController.viewUserDetail);
adminRoutes.get('/users/all', adminController.getAllUsers);

// // Ban user
// adminRoutes.patch('/:id/ban', adminController.banUser);

// // Unban user
// adminRoutes.patch('/:id/unban', adminController.unbanUser);

adminRoutes.put('/communities/:id', adminController.updateCommunityDetails);

adminRoutes.get('/communities/all', adminController.getAllCommunities);

adminRoutes.delete(
  '/users/delete',
  validate(adminValidation.deleteUser),
  adminController.deleteUser
);
// adminRoutes.delete('/comments/:id', adminController.deleteComment);

export default adminRoutes;
