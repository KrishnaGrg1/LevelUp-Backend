import { Router } from 'express';
import authRoutes from './authRoutes';
// import goalRoute from './goalRoutes';
import { authMiddleware } from '../middlewares/authMiddleware';
import adminRoutes from './adminRoutes';
import communityRoutes from './communityRoutes';
import { adminMiddleware } from '../middlewares/adminMiddleware';
import clanRoutes from './clanRoutes';
import ticketRoutes from './ticketRoutes';
import skillRoutes from './skillRoutes';
import questRoutes from './questRoutes';
import subscriptionRoutes from './subscriptionRoutes';
import milestoneRoutes from './milestoneRoutes';
import aiRoutes from './aiRoutes';
import feedRoutes from './feedRoutes';

const mainRoutes = Router();

mainRoutes.use('/auth', authRoutes);
mainRoutes.use('/admin', authMiddleware, adminMiddleware, adminRoutes);
mainRoutes.use('/community', authMiddleware, communityRoutes);
mainRoutes.use('/clan', authMiddleware, clanRoutes);
// mainRoutes.use('/goal', authMiddleware, goalRoute);
mainRoutes.use('/ticket', authMiddleware, ticketRoutes);
mainRoutes.use('/skills', authMiddleware, skillRoutes);
mainRoutes.use('/quests', authMiddleware, questRoutes);
mainRoutes.use('/subscription', authMiddleware, subscriptionRoutes);
mainRoutes.use('/milestones', authMiddleware, milestoneRoutes);
mainRoutes.use('/ai', authMiddleware, aiRoutes);
mainRoutes.use('/feed', authMiddleware, feedRoutes);
mainRoutes.use('/onboarding', authMiddleware, skillRoutes); // /onboarding/select-skills maps to skillRoutes

export default mainRoutes;
