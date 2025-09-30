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
export default adminRoutes;
