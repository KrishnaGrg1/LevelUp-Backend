import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import { Language, translate } from '../translation/translation';
import OpenAIChat from '../helpers/ai/aiHelper';
import { getChatModerationPrompt } from '../helpers/ai/prompts';
import env from '../helpers/config';
import { MemberStatus } from '@prisma/client';
import client from '../helpers/prisma';
import {
  runDailyAiQuestForUser,
  runDailyAiQuestNow,
} from '../jobs/aiDailyQuests';
import {
  runWeeklyAiQuestForUser,
  runWeeklyAiQuestNow,
} from '../jobs/aiWeeklyQuests';
import logger from '../helpers/logger';
import { computeLevelFromXp } from '../helpers/leveling';
import {
  consumeTokens,
  refundTokens,
  getTokenCostPerChat,
} from '../helpers/ai/tokenService';

const ensureAIConfigured = () => {
  const apiKey = env.OPENAI_API_KEY as string | undefined;
  const model = env.MODEL_NAME as string | undefined;
  return Boolean(apiKey && model);
};

const chat = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const { prompt } = req.body as { prompt?: string };
    if (!prompt || typeof prompt !== 'string') {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Prompt is required'),
            'error.ai.prompt_required',
            lang,
            400
          )
        );
    }

    if (!ensureAIConfigured()) {
      return res
        .status(503)
        .json(
          makeErrorResponse(
            new Error('AI not configured'),
            'error.ai.not_configured',
            lang,
            503
          )
        );
    }

    const systemPrompt = getChatModerationPrompt(prompt);
    if ((env.NODE_ENV as string) !== 'production') {
      logger.debug('AI chat request', {
        promptChars: prompt.length,
        systemPromptChars: systemPrompt.length,
      });
    }
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
    }

    const tokenCost = getTokenCostPerChat();
    const tokenResult = await consumeTokens(userId, tokenCost);
    if (!tokenResult.ok) {
      return res
        .status(402)
        .json(
          makeErrorResponse(
            new Error('Insufficient tokens'),
            'error.ai.insufficient_tokens',
            lang,
            402
          )
        );
    }

    let tokensDebited = true;
    try {
      const message = await OpenAIChat({ prompt: systemPrompt });
      const reply =
        message?.content ?? translate('success.ai.no_response', lang);
      if ((env.NODE_ENV as string) !== 'production') {
        logger.debug('AI chat reply', {
          replyChars: reply.length,
          replyPreview: reply.slice(0, 200).replace(/\s+/g, ' '),
        });
      }

      return res
        .status(200)
        .json(
          makeSuccessResponse(
            { reply, remainingTokens: tokenResult.remainingTokens },
            'success.ai.chat',
            lang,
            200
          )
        );
    } catch (err) {
      if (tokensDebited) {
        try {
          await refundTokens(userId, tokenCost);
        } catch (refundError) {
          logger.error('[AI Chat] Failed to refund tokens', refundError, {
            userId,
            tokenCost,
          });
        }
      }
      throw err;
    }
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('AI chat failed'),
          'error.ai.chat_failed',
          lang,
          500
        )
      );
  }
};

const generateDailyQuests = async (req: AuthRequest, res: Response) => {
  logger.debug('generateDailyQuests called', { userId: req.user?.id });
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
    }
    await runDailyAiQuestForUser(userId);
    const today = await (client as any).quest.findMany({
      where: { userId, type: 'Daily', periodStatus: 'TODAY' },
      orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }],
    });
    return res
      .status(200)
      .json(
        makeSuccessResponse({ today }, 'success.ai.quests_generated', lang, 200)
      );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to generate daily quests'),
          'error.ai.generate_failed',
          lang,
          500
        )
      );
  }
};

const generateWeeklyQuests = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
    }
    await runWeeklyAiQuestForUser(userId);
    const thisWeek = await (client as any).quest.findMany({
      where: { userId, type: 'Weekly', periodStatus: 'THIS_WEEK' },
      orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }],
    });
    return res
      .status(200)
      .json(
        makeSuccessResponse(
          { thisWeek },
          'success.ai.quests_generated',
          lang,
          200
        )
      );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to generate weekly quests'),
          'error.ai.generate_failed',
          lang,
          500
        )
      );
  }
};

const getDailyQuests = async (req: AuthRequest, res: Response) => {
  logger.debug('getDailyQuests called', { userId: req.user?.id });
  const lang = (req.language as Language) || 'eng';
  const userId = req.user?.id;
  if (!userId) {
    return res
      .status(401)
      .json(
        makeErrorResponse(
          new Error('Not authenticated'),
          'error.auth.not_authenticated',
          lang,
          401
        )
      );
  }
  try {
    const [today, yesterday, dayBeforeYesterday] = await Promise.all([
      (client as any).quest.findMany({
        where: { userId, type: 'Daily', periodStatus: 'TODAY' },
        orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }],
      }),
      (client as any).quest.findMany({
        where: { userId, type: 'Daily', periodStatus: 'YESTERDAY' },
        orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }],
      }),
      (client as any).quest.findMany({
        where: { userId, type: 'Daily', periodStatus: 'DAY_BEFORE_YESTERDAY' },
        orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }],
      }),
    ]);
    return res
      .status(200)
      .json(
        makeSuccessResponse(
          { today, yesterday, dayBeforeYesterday },
          'success.ai.quests_generated',
          lang,
          200
        )
      );
  } catch (e) {
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch daily quests'),
          'error.ai.generate_failed',
          lang,
          500
        )
      );
  }
};

const getWeeklyQuests = async (req: AuthRequest, res: Response) => {
  const lang = (req.language as Language) || 'eng';
  const userId = req.user?.id;
  if (!userId) {
    return res
      .status(401)
      .json(
        makeErrorResponse(
          new Error('Not authenticated'),
          'error.auth.not_authenticated',
          lang,
          401
        )
      );
  }
  try {
    const [thisWeek, lastWeek, twoWeeksAgo] = await Promise.all([
      (client as any).quest.findMany({
        where: { userId, type: 'Weekly', periodStatus: 'THIS_WEEK' },
        orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }],
      }),
      (client as any).quest.findMany({
        where: { userId, type: 'Weekly', periodStatus: 'LAST_WEEK' },
        orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }],
      }),
      (client as any).quest.findMany({
        where: { userId, type: 'Weekly', periodStatus: 'TWO_WEEKS_AGO' },
        orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }],
      }),
    ]);
    return res
      .status(200)
      .json(
        makeSuccessResponse(
          { thisWeek, lastWeek, twoWeeksAgo },
          'success.ai.quests_generated',
          lang,
          200
        )
      );
  } catch (e) {
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch weekly quests'),
          'error.ai.generate_failed',
          lang,
          500
        )
      );
  }
};

const health = async (req: AuthRequest, res: Response) => {
  const lang = (req.language as Language) || 'eng';
  const startTime = Date.now();

  try {
    // Check AI configuration
    const aiConfigured = ensureAIConfigured();

    // Check database connectivity
    let dbHealthy = false;
    let dbResponseTime = 0;
    try {
      const dbStart = Date.now();
      await client.$queryRaw`SELECT 1`;
      dbResponseTime = Date.now() - dbStart;
      dbHealthy = true;
    } catch (dbError) {
      logger.error('[Health] Database check failed', dbError);
    }

    // Get quest generation statistics
    let questStats = null;
    if (dbHealthy) {
      try {
        const [totalQuests, completedQuests, todayQuests, thisWeekQuests] =
          await Promise.all([
            client.quest.count(),
            client.quest.count({ where: { isCompleted: true } }),
            client.quest.count({
              where: { type: 'Daily', periodStatus: 'TODAY' },
            }),
            client.quest.count({
              where: { type: 'Weekly', periodStatus: 'THIS_WEEK' },
            }),
          ]);
        questStats = {
          total: totalQuests,
          completed: completedQuests,
          todayActive: todayQuests,
          thisWeekActive: thisWeekQuests,
          completionRate:
            totalQuests > 0
              ? Math.round((completedQuests / totalQuests) * 100)
              : 0,
        };
      } catch (statError) {
        logger.error('[Health] Quest stats failed', statError);
      }
    }

    const responseTime = Date.now() - startTime;
    const overallHealthy = aiConfigured && dbHealthy;

    const healthData = {
      status: overallHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime,
      services: {
        ai: {
          configured: aiConfigured,
          model: env.MODEL_NAME || null,
        },
        database: {
          healthy: dbHealthy,
          responseTime: dbResponseTime,
        },
      },
      quests: questStats,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
    };

    const statusCode = overallHealthy ? 200 : 503;
    return res
      .status(statusCode)
      .json(
        makeSuccessResponse(healthData, 'success.ai.health', lang, statusCode)
      );
  } catch (error) {
    logger.error('[Health] Health check failed', error);
    return res
      .status(503)
      .json(
        makeErrorResponse(
          new Error('Health check failed'),
          'error.ai.health_check_failed',
          lang,
          503
        )
      );
  }
};

const config = async (req: AuthRequest, res: Response) => {
  const lang = (req.language as Language) || 'eng';
  const userId = req.user?.id;

  try {
    // Get user-specific data if authenticated
    let userData = null;
    if (userId) {
      try {
        const user = await client.user.findUnique({
          where: { id: userId },
          select: {
            tokens: true,
            timezone: true,
            _count: {
              select: {
                Quest: true,
                CommunityMember: true,
              },
            },
          },
        });

        if (user) {
          const completedQuests = await client.quest.count({
            where: { userId, isCompleted: true },
          });

          userData = {
            tokens: user.tokens,
            timezone: user.timezone,
            totalQuests: user._count.Quest,
            completedQuests,
            communities: user._count.CommunityMember,
          };
        }
      } catch (userError) {
        logger.error('[Config] User data fetch failed', userError, { userId });
      }
    }

    const payload = {
      version: '1.0.0',
      environment: env.NODE_ENV,
      ai: {
        configured: ensureAIConfigured(),
        model: env.MODEL_NAME || null,
        maxPromptChars: 4000,
        tokenCostPerChat: getTokenCostPerChat(),
      },
      quests: {
        dailyCount: 5,
        weeklyCount: 5,
        generationSchedule: {
          daily: 'Hourly (0 * * * *)',
          weekly: 'Monday midnight (0 0 * * 1)',
        },
        questsPerCommunity: 5,
        periodStatuses: {
          daily: ['TODAY', 'YESTERDAY', 'DAY_BEFORE_YESTERDAY'],
          weekly: ['THIS_WEEK', 'LAST_WEEK', 'TWO_WEEKS_AGO'],
        },
      },
      features: {
        aiChat: ensureAIConfigured(),
        questGeneration: true,
        questCompletion: true,
        xpRewards: true,
        timezoneSupport: true,
      },
      limits: {
        maxPromptLength: 4000,
        maxDescriptionLength: 500,
        minDescriptionLength: 1,
      },
      user: userData,
    };

    return res
      .status(200)
      .json(makeSuccessResponse(payload, 'success.ai.config', lang, 200));
  } catch (error) {
    logger.error('[Config] Config fetch failed', error);
    const fallbackPayload = {
      version: '1.0.0',
      environment: env.NODE_ENV,
      ai: { configured: ensureAIConfigured() },
    };
    return res
      .status(200)
      .json(
        makeSuccessResponse(fallbackPayload, 'success.ai.config', lang, 200)
      );
  }
};

const getSingleQuest = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    const { questId } = req.params;

    if (!userId) {
      return res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
    }

    const quest = await client.quest.findUnique({
      where: { id: questId },
      include: {
        community: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!quest) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Quest not found'),
            'error.ai.quest_not_found',
            lang,
            404
          )
        );
    }

    // Verify ownership
    if (quest.userId !== userId) {
      return res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('Not authorized'),
            'error.auth.not_authorized',
            lang,
            403
          )
        );
    }

    return res
      .status(200)
      .json(
        makeSuccessResponse({ quest }, 'success.ai.quest_fetched', lang, 200)
      );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch quest'),
          'error.ai.fetch_quest_failed',
          lang,
          500
        )
      );
  }
};

const deleteQuest = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const { questId } = req.params;

    const quest = await client.quest.findUnique({
      where: { id: questId },
      select: { id: true, userId: true, description: true },
    });

    if (!quest) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Quest not found'),
            'error.ai.quest_not_found',
            lang,
            404
          )
        );
    }

    await client.quest.delete({
      where: { id: questId },
    });

    return res
      .status(200)
      .json(
        makeSuccessResponse(
          { deletedQuestId: questId, userId: quest.userId },
          'success.ai.quest_deleted',
          lang,
          200
        )
      );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to delete quest'),
          'error.ai.delete_quest_failed',
          lang,
          500
        )
      );
  }
};

const forceDailyQuests = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
    }

    logger.debug('[Force Daily] Forcing daily quest generation', { userId });
    await runDailyAiQuestForUser(userId, true);

    const today = await client.quest.findMany({
      where: { userId, type: 'Daily', periodStatus: 'TODAY' },
      orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }],
      include: {
        community: {
          select: { id: true, name: true, description: true },
        },
      },
    });

    return res
      .status(200)
      .json(
        makeSuccessResponse(
          { today, count: today.length, forced: true },
          'success.ai.quests_force_generated',
          lang,
          200
        )
      );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    logger.error('[Force Daily] Error', e, { userId: req.user?.id });
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to force generate daily quests'),
          'error.ai.force_generate_failed',
          lang,
          500
        )
      );
  }
};

const forceWeeklyQuests = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
    }

    logger.debug('[Force Weekly] Forcing weekly quest generation', { userId });
    await runWeeklyAiQuestForUser(userId, true);

    const thisWeek = await client.quest.findMany({
      where: { userId, type: 'Weekly', periodStatus: 'THIS_WEEK' },
      orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }],
      include: {
        community: {
          select: { id: true, name: true, description: true },
        },
      },
    });

    return res
      .status(200)
      .json(
        makeSuccessResponse(
          { thisWeek, count: thisWeek.length, forced: true },
          'success.ai.quests_force_generated',
          lang,
          200
        )
      );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    logger.error('[Force Weekly] Error', e, { userId: req.user?.id });
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to force generate weekly quests'),
          'error.ai.force_generate_failed',
          lang,
          500
        )
      );
  }
};

const getCompletedQuests = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
    }

    // Support pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    // Support filtering by type
    const type = req.query.type as 'Daily' | 'Weekly' | undefined;
    const whereClause: any = {
      userId,
      isCompleted: true,
    };

    if (type && (type === 'Daily' || type === 'Weekly')) {
      whereClause.type = type;
    }

    const [completedQuests, totalCount] = await Promise.all([
      client.quest.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          community: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      }),
      client.quest.count({ where: whereClause }),
    ]);

    return res.status(200).json(
      makeSuccessResponse(
        {
          quests: completedQuests,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasMore: skip + completedQuests.length < totalCount,
          },
        },
        'success.ai.completed_quests_fetched',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch completed quests'),
          'error.ai.fetch_completed_failed',
          lang,
          500
        )
      );
  }
};

const completeQuest = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    const { questId } = req.body as { questId: string };

    if (!userId) {
      return res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
    }

    if (!questId) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Quest ID is required'),
            'error.ai.quest_id_required',
            lang,
            400
          )
        );
    }

    const quest = await (client as any).quest.findUnique({
      where: { id: questId },
      select: {
        id: true,
        userId: true,
        isCompleted: true,
        description: true,
        xpValue: true,
        type: true,
        communityId: true,
        startedAt: true,
        estimatedMinutes: true,
      },
    });

    if (!quest) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Quest not found'),
            'error.ai.quest_not_found',
            lang,
            404
          )
        );
    }

    if (quest.userId !== userId) {
      return res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('Not authorized'),
            'error.auth.not_authorized',
            lang,
            403
          )
        );
    }

    if (quest.isCompleted) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Quest already completed'),
            'error.ai.quest_already_completed',
            lang,
            400
          )
        );
    }

    if (!quest.startedAt) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Quest must be started before completion'),
            'error.ai.quest_not_started',
            lang,
            400
          )
        );
    }

    const timeElapsed = Date.now() - new Date(quest.startedAt).getTime();
    const requiredMinutes = quest.estimatedMinutes || 30;
    const minTimeRequired = requiredMinutes * 60 * 1000;

    if (timeElapsed < minTimeRequired) {
      const remainingMinutes = Math.ceil(
        (minTimeRequired - timeElapsed) / 60000
      );
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error(
              `You must wait at least ${requiredMinutes} minutes before completing this quest. Time remaining: ${remainingMinutes} minutes.`
            ),
            'error.ai.quest_min_time_not_met',
            lang,
            400
          )
        );
    }

    const tokenReward =
      quest.type === 'Daily' ? 2 : quest.type === 'Weekly' ? 5 : 0;

    const communityMemberRecord = quest.communityId
      ? await (client as any).communityMember.findUnique({
          where: {
            userId_communityId: { userId, communityId: quest.communityId },
          },
          select: {
            userId: true,
            communityId: true,
            totalXP: true,
            level: true,
          },
        })
      : null;

    const clanMembership = quest.communityId
      ? await (client as any).clanMember.findFirst({
          where: { userId, communityId: quest.communityId },
          select: { clanId: true },
        })
      : null;

    const [
      updatedQuest,
      updatedUser,
      updatedCommunityMember,
      updatedCommunity,
      updatedClanMember,
      updatedClan,
    ] = await Promise.all([
      (client as any).quest.update({
        where: { id: questId },
        data: { isCompleted: true, completedAt: new Date() },
      }),
      (client as any).user.update({
        where: { id: userId },
        data: {
          xp: { increment: quest.xpValue },
          tokens: { increment: tokenReward },
        },
        select: { xp: true, level: true, tokens: true },
      }),
      quest.communityId && communityMemberRecord
        ? (client as any).communityMember.update({
            where: {
              userId_communityId: { userId, communityId: quest.communityId },
            },
            data: { totalXP: { increment: quest.xpValue } },
            select: { totalXP: true, level: true, communityId: true },
          })
        : Promise.resolve(null),
      quest.communityId
        ? (client as any).community.update({
            where: { id: quest.communityId },
            data: { xp: { increment: quest.xpValue } },
            select: { id: true, xp: true, level: true },
          })
        : Promise.resolve(null),
      clanMembership?.clanId
        ? (client as any).clanMember.update({
            where: { userId_clanId: { userId, clanId: clanMembership.clanId } },
            data: { totalXP: { increment: quest.xpValue } },
            select: { totalXP: true, clanId: true },
          })
        : Promise.resolve(null),
      clanMembership?.clanId
        ? (client as any).clan.update({
            where: { id: clanMembership.clanId },
            data: { xp: { increment: quest.xpValue } },
            select: { id: true, xp: true, level: true },
          })
        : Promise.resolve(null),
    ]);

    // Recompute and persist levels after XP gains (global, community, clan)
    const userProgress = computeLevelFromXp(updatedUser.xp);
    let finalUser = updatedUser;
    if (userProgress.level !== updatedUser.level) {
      finalUser = await (client as any).user.update({
        where: { id: userId },
        data: { level: userProgress.level },
        select: { xp: true, level: true, tokens: true },
      });
    }

    let finalCommunityMember = updatedCommunityMember;
    let finalCommunity = updatedCommunity;
    if (updatedCommunityMember) {
      const cmProgress = computeLevelFromXp(updatedCommunityMember.totalXP);
      if (cmProgress.level !== updatedCommunityMember.level) {
        finalCommunityMember = await (client as any).communityMember.update({
          where: {
            userId_communityId: {
              userId,
              communityId: updatedCommunityMember.communityId,
            },
          },
          data: { level: cmProgress.level },
          select: { totalXP: true, level: true, communityId: true },
        });
      }
    }

    if (updatedCommunity) {
      const communityProgress = computeLevelFromXp(updatedCommunity.xp);
      if (communityProgress.level !== updatedCommunity.level) {
        finalCommunity = await (client as any).community.update({
          where: { id: updatedCommunity.id },
          data: { level: communityProgress.level },
          select: { id: true, xp: true, level: true },
        });
      }
    }

    let finalClanMember = updatedClanMember;
    let finalClan = updatedClan;

    if (updatedClan) {
      const clanProgressOrg = computeLevelFromXp(updatedClan.xp);
      if (clanProgressOrg.level !== updatedClan.level) {
        finalClan = await (client as any).clan.update({
          where: { id: updatedClan.id },
          data: { level: clanProgressOrg.level },
          select: { id: true, xp: true, level: true },
        });
      }
    }

    return res.status(200).json(
      makeSuccessResponse(
        {
          quest: updatedQuest,
          xpAwarded: quest.xpValue,
          tokensAwarded: tokenReward,
          currentXp: finalUser.xp,
          currentLevel: finalUser.level,
          currentTokens: finalUser.tokens,
          communityXp:
            finalCommunityMember?.totalXP ??
            communityMemberRecord?.totalXP ??
            undefined,
          communityLevel:
            finalCommunityMember?.level ??
            communityMemberRecord?.level ??
            undefined,
          communityId:
            finalCommunityMember?.communityId ??
            communityMemberRecord?.communityId ??
            quest.communityId ??
            undefined,
          communityTotalXp: finalCommunity?.xp ?? undefined,
          communityTotalLevel: finalCommunity?.level ?? undefined,
          clanMemberXp: finalClanMember?.totalXP ?? undefined,
          clanId:
            finalClanMember?.clanId ??
            finalClan?.id ??
            clanMembership?.clanId ??
            undefined,
          clanTotalXp: finalClan?.xp ?? undefined,
          clanTotalLevel: finalClan?.level ?? undefined,
        },
        'success.ai.quest_completed',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    logger.error('Quest completion error', e, {
      questId: (req.body as any).questId,
      userId: req.user?.id,
    });
    return res
      .status(500)
      .json(
        makeErrorResponse(
          e instanceof Error ? e : new Error('Failed to complete quest'),
          'error.ai.complete_quest_failed',
          lang,
          500
        )
      );
  }
};

const startQuest = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    const { questId } = req.body as { questId: string };

    if (!userId) {
      return res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
    }

    if (!questId) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Quest ID is required'),
            'error.ai.quest_id_required',
            lang,
            400
          )
        );
    }

    const quest = await client.quest.findUnique({
      where: { id: questId },
      select: {
        id: true,
        userId: true,
        isCompleted: true,
        startedAt: true,
        description: true,
      },
    });

    if (!quest) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Quest not found'),
            'error.ai.quest_not_found',
            lang,
            404
          )
        );
    }

    if (quest.userId !== userId) {
      return res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('Not authorized'),
            'error.auth.not_authorized',
            lang,
            403
          )
        );
    }

    if (quest.isCompleted) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Quest already completed'),
            'error.ai.quest_already_completed',
            lang,
            400
          )
        );
    }

    if (quest.startedAt) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Quest already started'),
            'error.ai.quest_already_started',
            lang,
            400
          )
        );
    }

    const updatedQuest = await client.quest.update({
      where: { id: questId },
      data: { startedAt: new Date() },
    });

    return res
      .status(200)
      .json(
        makeSuccessResponse(
          { quest: updatedQuest },
          'success.ai.quest_started',
          lang,
          200
        )
      );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to start quest'),
          'error.ai.start_quest_failed',
          lang,
          500
        )
      );
  }
};

/**
 * Get AI chat history for authenticated user
 */
const getChatHistory = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const sessionId = req.query.sessionId as string | undefined;

    const whereClause: any = { userId };
    if (sessionId) {
      whereClause.sessionId = sessionId;
    }

    const [history, totalCount] = await Promise.all([
      client.aIChatHistory.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          sessionId: true,
          prompt: true,
          response: true,
          tokensUsed: true,
          responseTime: true,
          createdAt: true,
        },
      }),
      client.aIChatHistory.count({ where: whereClause }),
    ]);

    return res.status(200).json(
      makeSuccessResponse(
        {
          history,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasMore: skip + history.length < totalCount,
          },
        },
        'success.ai.chat_history_fetched',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch chat history'),
          'error.ai.chat_history_failed',
          lang,
          500
        )
      );
  }
};

/**
 * Get user's token balance
 */
const getTokenBalance = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
    }

    const [user, totalChats] = await Promise.all([
      client.user.findUnique({
        where: { id: userId },
        select: {
          tokens: true,
        },
      }),
      client.aIChatHistory.count({
        where: { userId },
      }),
    ]);
    const costPerChat = getTokenCostPerChat();

    if (!user) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('User not found'),
            'error.user.not_found',
            lang,
            404
          )
        );
    }

    return res.status(200).json(
      makeSuccessResponse(
        {
          tokens: user.tokens,
          totalChats,
          costPerChat,
        },
        'success.ai.token_balance_fetched',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch token balance'),
          'error.ai.token_balance_failed',
          lang,
          500
        )
      );
  }
};

/**
 * Get community memberships for the authenticated user including totalXP
 */
const getCommunityMemberships = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
    }

    const memberships = await client.communityMember.findMany({
      where: { userId },
      select: {
        communityId: true,
        totalXP: true,
        level: true,
        status: true,
        isPinned: true,
        community: {
          select: {
            id: true,
            name: true,
            description: true,
            photo: true,
          },
        },
      },
      orderBy: { totalXP: 'desc' },
    });

    return res
      .status(200)
      .json(
        makeSuccessResponse(
          { memberships },
          'success.community.memberships_fetched',
          lang,
          200
        )
      );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch memberships'),
          'error.community.memberships_failed',
          lang,
          500
        )
      );
  }
};

/**
 * Delete chat history (single or all)
 */
const deleteChatHistory = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    const { chatId } = req.params;
    const deleteAll = req.query.all === 'true';

    if (!userId) {
      return res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
    }

    if (deleteAll) {
      const result = await client.aIChatHistory.deleteMany({
        where: { userId },
      });

      return res
        .status(200)
        .json(
          makeSuccessResponse(
            { deletedCount: result.count },
            'success.ai.chat_history_deleted',
            lang,
            200
          )
        );
    } else if (chatId) {
      const chat = await client.aIChatHistory.findUnique({
        where: { id: chatId },
        select: { userId: true },
      });

      if (!chat) {
        return res
          .status(404)
          .json(
            makeErrorResponse(
              new Error('Chat not found'),
              'error.ai.chat_not_found',
              lang,
              404
            )
          );
      }

      if (chat.userId !== userId) {
        return res
          .status(403)
          .json(
            makeErrorResponse(
              new Error('Not authorized'),
              'error.auth.not_authorized',
              lang,
              403
            )
          );
      }

      await client.aIChatHistory.delete({
        where: { id: chatId },
      });

      return res
        .status(200)
        .json(
          makeSuccessResponse(
            { deletedChatId: chatId },
            'success.ai.chat_history_deleted',
            lang,
            200
          )
        );
    } else {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Chat ID required or use ?all=true'),
            'error.ai.invalid_request',
            lang,
            400
          )
        );
    }
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to delete chat history'),
          'error.ai.delete_chat_failed',
          lang,
          500
        )
      );
  }
};

/**
 * ADMIN: Generate daily quests for all users
 */
const adminGenerateDailyAll = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';

    logger.info('[Admin] Generating daily quests for all users');
    const startTime = Date.now();

    await runDailyAiQuestNow();

    const elapsed = Date.now() - startTime;

    const todayCount = await client.quest.count({
      where: { type: 'Daily', periodStatus: 'TODAY' },
    });

    return res.status(200).json(
      makeSuccessResponse(
        {
          message: 'Daily quests generated for all users',
          totalTodayQuests: todayCount,
          timeElapsed: `${elapsed}ms`,
        },
        'success.ai.admin_quests_generated',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    logger.error('[Admin] Generate daily all error', e);
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to generate daily quests for all users'),
          'error.ai.admin_generate_failed',
          lang,
          500
        )
      );
  }
};

/**
 * ADMIN: Generate daily quests for a specific user
 */
const adminGenerateDailyUser = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const { userId } = req.params;

    if (!userId) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('User ID is required'),
            'error.ai.user_id_required',
            lang,
            400
          )
        );
    }

    // Check if user exists
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { id: true, UserName: true, isBanned: true },
    });

    if (!user) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('User not found'),
            'error.user.not_found',
            lang,
            404
          )
        );
    }

    if (user.isBanned) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Cannot generate quests for banned user'),
            'error.ai.user_banned',
            lang,
            400
          )
        );
    }

    logger.info('[Admin] Generating daily quests for user', {
      userId,
      userName: user.UserName,
    });
    const startTime = Date.now();

    await runDailyAiQuestForUser(userId, true);

    const elapsed = Date.now() - startTime;

    const todayQuests = await client.quest.findMany({
      where: { userId, type: 'Daily', periodStatus: 'TODAY' },
      orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }],
      include: {
        community: {
          select: { id: true, name: true },
        },
      },
    });

    return res.status(200).json(
      makeSuccessResponse(
        {
          message: `Daily quests generated for user ${user.UserName}`,
          userId: user.id,
          username: user.UserName,
          quests: todayQuests,
          questCount: todayQuests.length,
          timeElapsed: `${elapsed}ms`,
        },
        'success.ai.admin_quests_generated',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    logger.error('[Admin] Generate daily user error', e, {
      userId: req.params.userId,
    });
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to generate daily quests for user'),
          'error.ai.admin_generate_failed',
          lang,
          500
        )
      );
  }
};

/**
 * ADMIN: Generate weekly quests for all users
 */
const adminGenerateWeeklyAll = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';

    logger.info('[Admin] Generating weekly quests for all users');
    const startTime = Date.now();

    await runWeeklyAiQuestNow();

    const elapsed = Date.now() - startTime;

    const thisWeekCount = await client.quest.count({
      where: { type: 'Weekly', periodStatus: 'THIS_WEEK' },
    });

    return res.status(200).json(
      makeSuccessResponse(
        {
          message: 'Weekly quests generated for all users',
          totalThisWeekQuests: thisWeekCount,
          timeElapsed: `${elapsed}ms`,
        },
        'success.ai.admin_quests_generated',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    logger.error('[Admin] Generate weekly all error', e);
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to generate weekly quests for all users'),
          'error.ai.admin_generate_failed',
          lang,
          500
        )
      );
  }
};

/**
 * ADMIN: Generate weekly quests for a specific user
 */
const adminGenerateWeeklyUser = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const { userId } = req.params;

    if (!userId) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('User ID is required'),
            'error.ai.user_id_required',
            lang,
            400
          )
        );
    }

    // Check if user exists
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { id: true, UserName: true, isBanned: true },
    });

    if (!user) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('User not found'),
            'error.user.not_found',
            lang,
            404
          )
        );
    }

    if (user.isBanned) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Cannot generate quests for banned user'),
            'error.ai.user_banned',
            lang,
            400
          )
        );
    }

    logger.info('[Admin] Generating weekly quests for user', {
      userId,
      userName: user.UserName,
    });
    const startTime = Date.now();

    await runWeeklyAiQuestForUser(userId, true);

    const elapsed = Date.now() - startTime;

    const thisWeekQuests = await client.quest.findMany({
      where: { userId, type: 'Weekly', periodStatus: 'THIS_WEEK' },
      orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }],
      include: {
        community: {
          select: { id: true, name: true },
        },
      },
    });

    return res.status(200).json(
      makeSuccessResponse(
        {
          message: `Weekly quests generated for user ${user.UserName}`,
          userId: user.id,
          username: user.UserName,
          quests: thisWeekQuests,
          questCount: thisWeekQuests.length,
          timeElapsed: `${elapsed}ms`,
        },
        'success.ai.admin_quests_generated',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    logger.error('[Admin] Generate weekly user error', e, {
      userId: req.params.userId,
    });
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to generate weekly quests for user'),
          'error.ai.admin_generate_failed',
          lang,
          500
        )
      );
  }
};

/**
 * ADMIN: Get quest statistics
 */
const adminGetQuestStats = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';

    const [
      totalQuests,
      completedQuests,
      todayQuests,
      thisWeekQuests,
      userCount,
      questsByType,
      questsByCommunity,
      recentCompletions,
    ] = await Promise.all([
      client.quest.count(),
      client.quest.count({ where: { isCompleted: true } }),
      client.quest.count({ where: { type: 'Daily', periodStatus: 'TODAY' } }),
      client.quest.count({
        where: { type: 'Weekly', periodStatus: 'THIS_WEEK' },
      }),
      client.user.count({ where: { isBanned: false } }),
      client.quest.groupBy({
        by: ['type'],
        _count: { id: true },
      }),
      client.quest.groupBy({
        by: ['communityId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      client.quest.findMany({
        where: { isCompleted: true },
        orderBy: { completedAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: { id: true, UserName: true },
          },
          community: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

    const completionRate =
      totalQuests > 0 ? Math.round((completedQuests / totalQuests) * 100) : 0;

    return res.status(200).json(
      makeSuccessResponse(
        {
          overview: {
            totalQuests,
            completedQuests,
            pendingQuests: totalQuests - completedQuests,
            completionRate: `${completionRate}%`,
            todayActive: todayQuests,
            thisWeekActive: thisWeekQuests,
            activeUsers: userCount,
          },
          byType: questsByType,
          byCommunity: questsByCommunity,
          recentCompletions,
        },
        'success.ai.admin_stats_fetched',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    logger.error('[Admin] Get quest stats error', e);
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch quest statistics'),
          'error.ai.admin_stats_failed',
          lang,
          500
        )
      );
  }
};

/**
 * ADMIN: Bulk delete quests
 */
const adminBulkDeleteQuests = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const { userId, communityId, type, periodStatus, startDate, endDate } =
      req.body as {
        userId?: string;
        communityId?: string;
        type?: 'Daily' | 'Weekly';
        periodStatus?: string;
        startDate?: string;
        endDate?: string;
      };

    // Build where clause
    const where: any = {};

    if (userId) where.userId = userId;
    if (communityId) where.communityId = communityId;
    if (type) where.type = type;
    if (periodStatus) where.periodStatus = periodStatus;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (Object.keys(where).length === 0) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error(
              'At least one filter is required (userId, communityId, type, periodStatus, or date range)'
            ),
            'error.ai.filter_required',
            lang,
            400
          )
        );
    }

    logger.info('[Admin] Bulk deleting quests with filters', {
      filters: where,
    });

    const result = await client.quest.deleteMany({ where });

    return res.status(200).json(
      makeSuccessResponse(
        {
          message: 'Quests deleted successfully',
          deletedCount: result.count,
          filters: where,
        },
        'success.ai.admin_quests_deleted',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    logger.error('[Admin] Bulk delete quests error', e);
    return res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to delete quests'),
          'error.ai.admin_delete_failed',
          lang,
          500
        )
      );
  }
};

const aiController = {
  chat,
  generateDailyQuests,
  generateWeeklyQuests,
  getDailyQuests,
  getWeeklyQuests,
  getSingleQuest,
  deleteQuest,
  forceDailyQuests,
  forceWeeklyQuests,
  getCompletedQuests,
  startQuest,
  completeQuest,
  getChatHistory,
  getTokenBalance,
  deleteChatHistory,
  health,
  config,
  getCommunityMemberships,
  adminGenerateDailyAll,
  adminGenerateDailyUser,
  adminGenerateWeeklyAll,
  adminGenerateWeeklyUser,
  adminGetQuestStats,
  adminBulkDeleteQuests,
};

export default aiController;
