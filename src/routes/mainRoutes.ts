import { Router } from 'express';
import authRoutes from './authRoutes';
// import goalRoute from './goalRoutes';
import { authMiddleware } from '../middlewares/authMiddleware';

const mainRoutes = Router();

mainRoutes.use('/auth', authRoutes);
// mainRoutes.use('/goal', authMiddleware, goalRoute);
export default mainRoutes;
