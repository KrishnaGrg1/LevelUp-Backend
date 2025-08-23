import { Router } from 'express';
import authController from '../controllers/authControllers';
import validate from '../middlewares/validation';
import authValidation from '../validations/authValidation';
import { authMiddleware } from '../middlewares/authMiddleware';

const authRoutes = Router();

authRoutes.post(
  '/register',

  authController.register
);

authRoutes.post(
  '/verify-email',

  authController.verifyOTPLink
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
authRoutes.post('/verify-otp', authController.verifyOTP);
authRoutes.post('/logout', authMiddleware, authController.logout);
export default authRoutes;
