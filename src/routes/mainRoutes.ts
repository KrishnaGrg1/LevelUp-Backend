import { Router } from 'express';
import authRoutes from './authRoutes';
// import goalRoute from './goalRoutes';
import { authMiddleware } from '../middlewares/authMiddleware';
import adminRoutes from './adminRoutes';
import communityRoutes from './communityRoutes';

const mainRoutes = Router();

mainRoutes.use('/auth', authRoutes);
mainRoutes.use('/admin', authMiddleware, adminRoutes);
mainRoutes.use('/community', authMiddleware, communityRoutes);
// mainRoutes.use('/goal', authMiddleware, goalRoute);
export default mainRoutes;
