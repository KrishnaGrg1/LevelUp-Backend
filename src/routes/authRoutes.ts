import { Router } from 'express';
import authController from '../controllers/authControllers';
import validate from '../middlewares/validation';
import authValidation from '../validations/authValidation';
import { authMiddleware } from '../middlewares/authMiddleware';
import oauthController from '../controllers/oauthController';
import { uploadProfilePicture } from '../helpers/files/multer';

const authRoutes = Router();

//Fetch Caetegories
authRoutes.get(
  '/categories', 
  authController.fetchCategories
);

  authRoutes.post(
  '/register',
  validate(authValidation.register),
  authController.register
);

authRoutes.post(
  '/login', 
  validate(authValidation.login), 
  authController.login
);

authRoutes.post(
  '/forget-password',
  validate(authValidation.forget_password),
  authController.forgetPassword
);

authRoutes.post(
  '/reset-password',
  validate(authValidation.reset_password),
  authController.resetPassword
);

authRoutes.get(
  '/me', 
  authMiddleware, 
  authController.me
);

authRoutes.post(
  '/verify-email',
  validate(authValidation.verify_email),
  authController.verifyEmail
);

authRoutes.post(
  '/logout', 
  authMiddleware, 
  authController.logout
);

authRoutes.post(
  '/deleteAccount', 
  authMiddleware, 
  authController.deleteAccount
);

// Upload profile picture route
authRoutes.post(
  '/upload-profile-picture',
  authMiddleware,
  uploadProfilePicture.single('profilePicture'),
  authController.uploadProfilePicture
);

authRoutes.post(
  '/oauth/register', 
  oauthController.oauthLogin
);

authRoutes.post(
  '/change-password',
  validate(authValidation.change_password),
  authMiddleware,
  authController.changePassword
);

authRoutes.post(
  '/onBoarding',
  authMiddleware,
  authController.onBoarding
);

export default authRoutes;
