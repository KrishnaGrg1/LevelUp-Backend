import { Response } from 'express';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Language } from '../translation/translation';
import client from '../helpers/prisma';

/**
 * Get dashboard feed
 * GET /feed/dashboard
 * Returns user profile, subscription, tokens, today's quests, streaks, milestones, upsell hints
 */
const getDashboard = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;

    if (!userId) {
      res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
      return;
    }

    // Get user with all related data
    const user = await client.user.findUnique({
      where: { id: userId },
      include: {
        subscription: true,
        DailyStreak: true,
        userSkills: {
          include: {
            skill: true,
          },
          orderBy: {
            updatedAt: 'desc',
          },
        },
        UserMilestone: {
          include: {
            milestone: true,
          },
          orderBy: {
            achievedAt: 'desc',
          },
          take: 5,
        },
      },
    });

    if (!user) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('User not found'),
            'error.auth.user_not_found',
            lang,
            404
          )
        );
      return;
    }

    // Get today's quests grouped by skill
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayQuests = await client.quest.findMany({
      where: {
        userId,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        userSkill: {
          include: {
            skill: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group quests by skill
    const questsBySkill = todayQuests.reduce((acc: any, quest) => {
      const skillName = quest.userSkill?.skill.name || 'General';
      if (!acc[skillName]) {
        acc[skillName] = [];
      }
      acc[skillName].push(quest);
      return acc;
    }, {});

    // Get upsell triggers (last 3)
    const upsellHints = await client.upsellTrigger.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
      take: 3,
    });

    // Determine if should show upsell
    const shouldShowUpsell = shouldShowUpsellToUser(user, upsellHints);

    res.status(200).json(
      makeSuccessResponse(
        {
          user: {
            id: user.id,
            username: user.UserName,
            email: user.email,
            xp: user.xp,
            level: user.level,
            tokens: user.tokens,
          },
          subscription: user.subscription || { plan: 'FREE' },
          streak: user.DailyStreak || { count: 0 },
          skills: user.userSkills,
          todayQuests: {
            bySkill: questsBySkill,
            total: todayQuests.length,
            completed: todayQuests.filter((q) => q.isCompleted).length,
          },
          recentMilestones: user.UserMilestone,
          upsell: shouldShowUpsell,
        },
        'success.feed.dashboard',
        lang,
        200
      )
    );
    return;
  } catch (e: unknown) {
    console.error('Dashboard error:', e);
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch dashboard'),
          'error.feed.failed',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Determine if should show upsell to user
 */
function shouldShowUpsellToUser(user: any, upsellHints: any[]): any {
  const plan = user.subscription?.plan || 'FREE';

  if (plan === 'ULTRA') {
    return null; // No upsell for ULTRA users
  }

  const reasons = [];

  // Check for insufficient tokens
  if (user.tokens < 10) {
    reasons.push({
      type: 'low_tokens',
      message: 'You are running low on tokens',
      suggestedPlan: plan === 'FREE' ? 'PRO' : 'ULTRA',
    });
  }

  // Check for streak milestones
  const streakCount = user.DailyStreak?.count || 0;
  if ([3, 7, 21].includes(streakCount) && plan === 'FREE') {
    reasons.push({
      type: 'streak_milestone',
      message: `Congratulations on your ${streakCount}-day streak!`,
      suggestedPlan: 'PRO',
    });
  }

  // Check for repeated AI usage attempts
  const aiChatAttempts = upsellHints.filter((h) =>
    h.type.includes('ai_chat')
  ).length;
  if (aiChatAttempts >= 2 && plan !== 'ULTRA') {
    reasons.push({
      type: 'frequent_ai_user',
      message: 'Upgrade to ULTRA for unlimited AI chat',
      suggestedPlan: 'ULTRA',
    });
  }

  return reasons.length > 0 ? { show: true, reasons } : null;
}

const feedController = {
  getDashboard,
};

export default feedController;
