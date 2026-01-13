import { Router } from 'express';
import leaderboardController from '../controllers/leaderboardController';
import { authMiddleware } from '../middlewares/authMiddleware';

const leaderboardRoutes = Router();

// Overall user leaderboard
leaderboardRoutes.get(
  '/',
  authMiddleware,
  leaderboardController.getGlobalLeaderboard
);

// Community leaderboard (members ranked by community XP)
leaderboardRoutes.get(
  '/community/:communityId',
  authMiddleware,
  leaderboardController.getCommunityLeaderboard
);

// Top communities (supports ?sortBy=xp|members|createdAt&order=asc|desc)
leaderboardRoutes.get(
  '/top-communities',
  authMiddleware,
  leaderboardController.getTopCommunities
);

// Clan leaderboard (members ranked by clan XP)
leaderboardRoutes.get(
  '/clan/:clanId',
  authMiddleware,
  leaderboardController.getClanLeaderboard
);

// Top clans (supports ?communityId=&sortBy=xp|members|createdAt&order=asc|desc)
leaderboardRoutes.get(
  '/top-clans',
  authMiddleware,
  leaderboardController.getTopClans
);

export default leaderboardRoutes;
