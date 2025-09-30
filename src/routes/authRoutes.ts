import { Router } from 'express';
import authController from '../controllers/authControllers';
import validate from '../middlewares/validation';
import authValidation from '../validations/authValidation';
import { authMiddleware } from '../middlewares/authMiddleware';
import oauthController from '../controllers/oauthController';

const authRoutes = Router();

authRoutes.post(
  '/register',
  validate(authValidation.register),
  authController.register
);

authRoutes.post('/login', validate(authValidation.login), authController.login);

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
authRoutes.get('/me', authMiddleware, authController.me);
authRoutes.post('/verify-email', authController.verifyEmail);
authRoutes.post('/logout', authMiddleware, authController.logout);
authRoutes.post('/deleteAccount', authMiddleware, authController.deleteAccount);

authRoutes.post('/oauth/register', oauthController.oauthLogin);
export default authRoutes;
