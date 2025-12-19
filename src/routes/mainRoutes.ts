import { Router } from 'express';
import authRoutes from './authRoutes';
// import goalRoute from './goalRoutes';
import { authMiddleware } from '../middlewares/authMiddleware';
import adminRoutes from './adminRoutes';
import communityRoutes from './communityRoutes';
import { adminMiddleware } from '../middlewares/adminMiddleware';
import clanRoutes from './clanRoutes';
import aiRoutes from './aiRoutes';
import ticketRoutes from './ticketRoutes';
import messageRoutes from './messageRoutes';
import leaderboardRoutes from './leaderboardRoutes';
import healthRoutes from './healthRoutes';

const mainRoutes = Router();

mainRoutes.use(
    '/auth', 
    authRoutes
);

mainRoutes.use(
    '/admin', 
    authMiddleware, 
    adminMiddleware, 
    adminRoutes
);

mainRoutes.use(
    '/community', 
    authMiddleware, 
    communityRoutes
);

mainRoutes.use(
    '/messages', 
    authMiddleware, 
    messageRoutes
);

mainRoutes.use(
    '/clan', 
    authMiddleware, 
    clanRoutes
);

mainRoutes.use(
    '/ai', 
    authMiddleware, 
    aiRoutes
);

mainRoutes.use(
    '/leaderboard',
    leaderboardRoutes
);

// mainRoutes.use('/goal', authMiddleware, goalRoute);
mainRoutes.use('/ticket', authMiddleware, ticketRoutes);
mainRoutes.use('/health', healthRoutes);
export default mainRoutes;
