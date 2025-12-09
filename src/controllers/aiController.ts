import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { makeErrorResponse, makeSuccessResponse } from '../helpers/standardResponse';
import { Language, translate } from '../translation/translation';
import OpenAIChat from '../helpers/ai/aiHelper';
import { getChatModerationPrompt } from '../helpers/ai/prompts';
import env from '../helpers/config';
import { MemberStatus } from '@prisma/client';
import client from '../helpers/prisma';
import { runDailyAiQuestForUser, runDailyAiQuestNow } from '../jobs/aiDailyQuests';
import { runWeeklyAiQuestForUser, runWeeklyAiQuestNow } from '../jobs/aiWeeklyQuests';

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
      return res.status(400).json(
        makeErrorResponse(new Error('Prompt is required'), 'error.ai.prompt_required', lang, 400)
      );
    }

    if (!ensureAIConfigured()) {
      return res.status(503).json(
        makeErrorResponse(new Error('AI not configured'), 'error.ai.not_configured', lang, 503)
      );
    }

    const systemPrompt = getChatModerationPrompt(prompt);
    if ((env.NODE_ENV as string) !== 'production') {
      console.debug(`[AI] chat request promptChars=${prompt.length} systemPromptChars=${systemPrompt.length}`);
    }
    // Check tokens
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json(
        makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401)
      );
    }

    const user = await (client as any).user.findUnique({ where: { id: userId }, select: { tokens: true } });
    if (!user || (user as any).tokens <= 0) {
      return res.status(402).json(
        makeErrorResponse(new Error('Insufficient tokens'), 'error.ai.insufficient_tokens', lang, 402)
      );
    }

    const message = await OpenAIChat({ prompt: systemPrompt });
    const reply = message?.content ?? translate('success.ai.no_response', lang);
    if ((env.NODE_ENV as string) !== 'production') {
      console.debug(`[AI] chat reply chars=${reply.length} preview="${reply.slice(0, 200).replace(/\s+/g, ' ')}"`);
    }
    // Deduct 1 token after successful call
    await (client as any).user.update({ where: { id: userId }, data: { tokens: { decrement: 1 } } });
    return res.status(200).json(makeSuccessResponse({ reply }, 'success.ai.chat', lang, 200));
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res.status(500).json(
      makeErrorResponse(new Error('AI chat failed'), 'error.ai.chat_failed', lang, 500)
    );
  }
};

const generateDailyQuests = async (req: AuthRequest, res: Response) => {

  console.log('generateDailyQuests called');
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json(makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401));
    }
    await runDailyAiQuestForUser(userId);
    // Return today's grouped quests per community
    const today = await (client as any).quest.findMany({ where: { userId, type: 'Daily', periodStatus: 'TODAY' }, orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }] });
    return res.status(200).json(makeSuccessResponse({ today }, 'success.ai.quests_generated', lang, 200));
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res.status(500).json(makeErrorResponse(new Error('Failed to generate daily quests'), 'error.ai.generate_failed', lang, 500));
  }
};

const generateWeeklyQuests = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json(makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401));
    }
    await runWeeklyAiQuestForUser(userId);
    const thisWeek = await (client as any).quest.findMany({ where: { userId, type: 'Weekly', periodStatus: 'THIS_WEEK' }, orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }] });
    return res.status(200).json(makeSuccessResponse({ thisWeek }, 'success.ai.quests_generated', lang, 200));
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res.status(500).json(makeErrorResponse(new Error('Failed to generate weekly quests'), 'error.ai.generate_failed', lang, 500));
  }
};

const getDailyQuests = async (req: AuthRequest, res: Response) => {
  console.log('getDailyQuests called');
  const lang = (req.language as Language) || 'eng';
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json(
      makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401)
    );
  }
  try {
    const [today, yesterday, dayBeforeYesterday] = await Promise.all([
      (client as any).quest.findMany({ where: { userId, type: 'Daily', periodStatus: 'TODAY' }, orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }] }),
      (client as any).quest.findMany({ where: { userId, type: 'Daily', periodStatus: 'YESTERDAY' }, orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }] }),
      (client as any).quest.findMany({ where: { userId, type: 'Daily', periodStatus: 'DAY_BEFORE_YESTERDAY' }, orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }] }),
    ]);
    return res.status(200).json(makeSuccessResponse({ today, yesterday, dayBeforeYesterday }, 'success.ai.quests_generated', lang, 200));
  } catch (e) {
    return res.status(500).json(makeErrorResponse(new Error('Failed to fetch daily quests'), 'error.ai.generate_failed', lang, 500));
  }
};

const getWeeklyQuests = async (req: AuthRequest, res: Response) => {
  const lang = (req.language as Language) || 'eng';
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json(
      makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401)
    );
  }
  try {
    const [thisWeek, lastWeek, twoWeeksAgo] = await Promise.all([
      (client as any).quest.findMany({ where: { userId, type: 'Weekly', periodStatus: 'THIS_WEEK' }, orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }] }),
      (client as any).quest.findMany({ where: { userId, type: 'Weekly', periodStatus: 'LAST_WEEK' }, orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }] }),
      (client as any).quest.findMany({ where: { userId, type: 'Weekly', periodStatus: 'TWO_WEEKS_AGO' }, orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }] }),
    ]);
    return res.status(200).json(makeSuccessResponse({ thisWeek, lastWeek, twoWeeksAgo }, 'success.ai.quests_generated', lang, 200));
  } catch (e) {
    return res.status(500).json(makeErrorResponse(new Error('Failed to fetch weekly quests'), 'error.ai.generate_failed', lang, 500));
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
      console.error('[Health] Database check failed:', dbError);
    }

    // Get quest generation statistics
    let questStats = null;
    if (dbHealthy) {
      try {
        const [totalQuests, completedQuests, todayQuests, thisWeekQuests] = await Promise.all([
          client.quest.count(),
          client.quest.count({ where: { isCompleted: true } }),
          client.quest.count({ where: { type: 'Daily', periodStatus: 'TODAY' } }),
          client.quest.count({ where: { type: 'Weekly', periodStatus: 'THIS_WEEK' } }),
        ]);
        questStats = {
          total: totalQuests,
          completed: completedQuests,
          todayActive: todayQuests,
          thisWeekActive: thisWeekQuests,
          completionRate: totalQuests > 0 ? Math.round((completedQuests / totalQuests) * 100) : 0,
        };
      } catch (statError) {
        console.error('[Health] Quest stats failed:', statError);
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
    return res.status(statusCode).json(
      makeSuccessResponse(healthData, 'success.ai.health', lang, statusCode)
    );
  } catch (error) {
    console.error('[Health] Health check failed:', error);
    return res.status(503).json(
      makeErrorResponse(new Error('Health check failed'), 'error.ai.health_check_failed', lang, 503)
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
        console.error('[Config] User data fetch failed:', userError);
      }
    }

    const payload = {
      version: '1.0.0',
      environment: env.NODE_ENV,
      ai: {
        configured: ensureAIConfigured(),
        model: env.MODEL_NAME || null,
        maxPromptChars: 4000,
        tokenCostPerChat: 1,
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

    return res.status(200).json(
      makeSuccessResponse(payload, 'success.ai.config', lang, 200)
    );
  } catch (error) {
    console.error('[Config] Config fetch failed:', error);
    const fallbackPayload = {
      version: '1.0.0',
      environment: env.NODE_ENV,
      ai: { configured: ensureAIConfigured() },
    };
    return res.status(200).json(
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
      return res.status(401).json(
        makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401)
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
      return res.status(404).json(
        makeErrorResponse(new Error('Quest not found'), 'error.ai.quest_not_found', lang, 404)
      );
    }

    // Verify ownership
    if (quest.userId !== userId) {
      return res.status(403).json(
        makeErrorResponse(new Error('Not authorized'), 'error.auth.not_authorized', lang, 403)
      );
    }

    return res.status(200).json(
      makeSuccessResponse({ quest }, 'success.ai.quest_fetched', lang, 200)
    );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to fetch quest'), 'error.ai.fetch_quest_failed', lang, 500)
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
      return res.status(404).json(
        makeErrorResponse(new Error('Quest not found'), 'error.ai.quest_not_found', lang, 404)
      );
    }

    await client.quest.delete({
      where: { id: questId },
    });

    return res.status(200).json(
      makeSuccessResponse(
        { deletedQuestId: questId, userId: quest.userId },
        'success.ai.quest_deleted',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to delete quest'), 'error.ai.delete_quest_failed', lang, 500)
    );
  }
};

const forceDailyQuests = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json(
        makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401)
      );
    }

    console.log(`[Force Daily] Forcing daily quest generation for user ${userId}`);
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

    return res.status(200).json(
      makeSuccessResponse(
        { today, count: today.length, forced: true },
        'success.ai.quests_force_generated',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    console.error('[Force Daily] Error:', e);
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to force generate daily quests'), 'error.ai.force_generate_failed', lang, 500)
    );
  }
};

const forceWeeklyQuests = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json(
        makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401)
      );
    }

    console.log(`[Force Weekly] Forcing weekly quest generation for user ${userId}`);
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

    return res.status(200).json(
      makeSuccessResponse(
        { thisWeek, count: thisWeek.length, forced: true },
        'success.ai.quests_force_generated',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    console.error('[Force Weekly] Error:', e);
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to force generate weekly quests'), 'error.ai.force_generate_failed', lang, 500)
    );
  }
};

const getCompletedQuests = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json(
        makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401)
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
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to fetch completed quests'), 'error.ai.fetch_completed_failed', lang, 500)
    );
  }
};

const completeQuest = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    const { questId } = req.body as { questId: string };

    if (!userId) {
      return res.status(401).json(
        makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401)
      );
    }

    if (!questId) {
      return res.status(400).json(
        makeErrorResponse(new Error('Quest ID is required'), 'error.ai.quest_id_required', lang, 400)
      );
    }

    // Find the quest and verify ownership
    const quest = await (client as any).quest.findUnique({
      where: { id: questId },
      select: { id: true, userId: true, isCompleted: true, description: true, xpValue: true, type: true, communityId: true, startedAt: true, estimatedMinutes: true },
    });

    if (!quest) {
      return res.status(404).json(
        makeErrorResponse(new Error('Quest not found'), 'error.ai.quest_not_found', lang, 404)
      );
    }

    if (quest.userId !== userId) {
      return res.status(403).json(
        makeErrorResponse(new Error('Not authorized'), 'error.auth.not_authorized', lang, 403)
      );
    }

    if (quest.isCompleted) {
      return res.status(400).json(
        makeErrorResponse(new Error('Quest already completed'), 'error.ai.quest_already_completed', lang, 400)
      );
    }

    // Validate quest was started
    if (!quest.startedAt) {
      return res.status(400).json(
        makeErrorResponse(new Error('Quest must be started before completion'), 'error.ai.quest_not_started', lang, 400)
      );
    }

    // Validate minimum time elapsed using AI-generated estimatedMinutes
    const timeElapsed = Date.now() - new Date(quest.startedAt).getTime();
    const requiredMinutes = quest.estimatedMinutes || 30; // Fallback to 30 if not set
    const minTimeRequired = requiredMinutes * 60 * 1000; // Convert to milliseconds
    
    if (timeElapsed < minTimeRequired) {
      const remainingMinutes = Math.ceil((minTimeRequired - timeElapsed) / 60000);
      return res.status(400).json(
        makeErrorResponse(
          new Error(`You must wait at least ${requiredMinutes} minutes before completing this quest. Time remaining: ${remainingMinutes} minutes.`),
          'error.ai.quest_min_time_not_met',
          lang,
          400
        )
      );
    }

    // Determine token reward based on quest type
    const tokenReward = quest.type === 'Daily' ? 2 : quest.type === 'Weekly' ? 5 : 0;

    // Mark quest as completed and award XP + tokens (global) + community XP
    const [updatedQuest, updatedUser, updatedCommunityMember] = await Promise.all([
      (client as any).quest.update({
        where: { id: questId },
        data: { isCompleted: true, completedAt: new Date() },
      }),
      (client as any).user.update({
        where: { id: userId },
        data: { xp: { increment: quest.xpValue }, tokens: { increment: tokenReward } },
        select: { xp: true, level: true, tokens: true },
      }),
      // Increment per-community XP if quest belongs to a community
      quest.communityId
        ? (client as any).communityMember.update({
            where: { userId_communityId: { userId, communityId: quest.communityId } },
            data: { totalXP: { increment: quest.xpValue } },
            select: { totalXP: true, level: true, communityId: true },
          })
        : Promise.resolve(null),
    ]);

    return res.status(200).json(
      makeSuccessResponse(
        {
          quest: updatedQuest,
          xpAwarded: quest.xpValue,
          tokensAwarded: tokenReward,
          currentXp: updatedUser.xp,
          currentLevel: updatedUser.level,
          currentTokens: updatedUser.tokens,
          communityXp: updatedCommunityMember?.totalXP ?? undefined,
          communityLevel: updatedCommunityMember?.level ?? undefined,
          communityId: updatedCommunityMember?.communityId ?? quest.communityId ?? undefined,
        },
        'success.ai.quest_completed',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to complete quest'), 'error.ai.complete_quest_failed', lang, 500)
    );
  };
};

const startQuest = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    const { questId } = req.body as { questId: string };

    if (!userId) {
      return res.status(401).json(
        makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401)
      );
    }

    if (!questId) {
      return res.status(400).json(
        makeErrorResponse(new Error('Quest ID is required'), 'error.ai.quest_id_required', lang, 400)
      );
    }

    // Find the quest and verify ownership
    const quest = await client.quest.findUnique({
      where: { id: questId },
      select: { id: true, userId: true, isCompleted: true, startedAt: true, description: true },
    });

    if (!quest) {
      return res.status(404).json(
        makeErrorResponse(new Error('Quest not found'), 'error.ai.quest_not_found', lang, 404)
      );
    }

    if (quest.userId !== userId) {
      return res.status(403).json(
        makeErrorResponse(new Error('Not authorized'), 'error.auth.not_authorized', lang, 403)
      );
    }

    if (quest.isCompleted) {
      return res.status(400).json(
        makeErrorResponse(new Error('Quest already completed'), 'error.ai.quest_already_completed', lang, 400)
      );
    }

    if (quest.startedAt) {
      return res.status(400).json(
        makeErrorResponse(new Error('Quest already started'), 'error.ai.quest_already_started', lang, 400)
      );
    }

    // Mark quest as started
    const updatedQuest = await client.quest.update({
      where: { id: questId },
      data: { startedAt: new Date() },
    });

    return res.status(200).json(
      makeSuccessResponse(
        { quest: updatedQuest },
        'success.ai.quest_started',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to start quest'), 'error.ai.start_quest_failed', lang, 500)
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
      return res.status(401).json(
        makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401)
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
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to fetch chat history'), 'error.ai.chat_history_failed', lang, 500)
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
      return res.status(401).json(
        makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401)
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

    if (!user) {
      return res.status(404).json(
        makeErrorResponse(new Error('User not found'), 'error.user.not_found', lang, 404)
      );
    }

    return res.status(200).json(
      makeSuccessResponse(
        {
          tokens: user.tokens,
          totalChats,
          costPerChat: 1,
        },
        'success.ai.token_balance_fetched',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to fetch token balance'), 'error.ai.token_balance_failed', lang, 500)
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
      return res.status(401).json(
        makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401)
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

    return res.status(200).json(
      makeSuccessResponse(
        { memberships },
        'success.community.memberships_fetched',
        lang,
        200
      )
    );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to fetch memberships'), 'error.community.memberships_failed', lang, 500)
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
      return res.status(401).json(
        makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401)
      );
    }

    if (deleteAll) {
      // Delete all chat history for user
      const result = await client.aIChatHistory.deleteMany({
        where: { userId },
      });

      return res.status(200).json(
        makeSuccessResponse(
          { deletedCount: result.count },
          'success.ai.chat_history_deleted',
          lang,
          200
        )
      );
    } else if (chatId) {
      // Delete specific chat
      const chat = await client.aIChatHistory.findUnique({
        where: { id: chatId },
        select: { userId: true },
      });

      if (!chat) {
        return res.status(404).json(
          makeErrorResponse(new Error('Chat not found'), 'error.ai.chat_not_found', lang, 404)
        );
      }

      if (chat.userId !== userId) {
        return res.status(403).json(
          makeErrorResponse(new Error('Not authorized'), 'error.auth.not_authorized', lang, 403)
        );
      }

      await client.aIChatHistory.delete({
        where: { id: chatId },
      });

      return res.status(200).json(
        makeSuccessResponse(
          { deletedChatId: chatId },
          'success.ai.chat_history_deleted',
          lang,
          200
        )
      );
    } else {
      return res.status(400).json(
        makeErrorResponse(new Error('Chat ID required or use ?all=true'), 'error.ai.invalid_request', lang, 400)
      );
    }
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to delete chat history'), 'error.ai.delete_chat_failed', lang, 500)
    );
  }
};

/**
 * ADMIN: Generate daily quests for all users
 */
const adminGenerateDailyAll = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    
    console.log('[Admin] Generating daily quests for all users');
    const startTime = Date.now();
    
    // Force generate for all non-banned users
    await runDailyAiQuestNow();
    
    const elapsed = Date.now() - startTime;
    
    // Count generated quests
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
    console.error('[Admin] Generate daily all error:', e);
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to generate daily quests for all users'), 'error.ai.admin_generate_failed', lang, 500)
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
      return res.status(400).json(
        makeErrorResponse(new Error('User ID is required'), 'error.ai.user_id_required', lang, 400)
      );
    }
    
    // Check if user exists
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { id: true, UserName: true, isBanned: true },
    });
    
    if (!user) {
      return res.status(404).json(
        makeErrorResponse(new Error('User not found'), 'error.user.not_found', lang, 404)
      );
    }
    
    if (user.isBanned) {
      return res.status(400).json(
        makeErrorResponse(new Error('Cannot generate quests for banned user'), 'error.ai.user_banned', lang, 400)
      );
    }
    
    console.log(`[Admin] Generating daily quests for user ${userId} (${user.UserName})`);
    const startTime = Date.now();
    
    await runDailyAiQuestForUser(userId, true);
    
    const elapsed = Date.now() - startTime;
    
    // Fetch generated quests
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
    console.error('[Admin] Generate daily user error:', e);
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to generate daily quests for user'), 'error.ai.admin_generate_failed', lang, 500)
    );
  }
};

/**
 * ADMIN: Generate weekly quests for all users
 */
const adminGenerateWeeklyAll = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    
    console.log('[Admin] Generating weekly quests for all users');
    const startTime = Date.now();
    
    // Force generate for all non-banned users
    await runWeeklyAiQuestNow();
    
    const elapsed = Date.now() - startTime;
    
    // Count generated quests
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
    console.error('[Admin] Generate weekly all error:', e);
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to generate weekly quests for all users'), 'error.ai.admin_generate_failed', lang, 500)
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
      return res.status(400).json(
        makeErrorResponse(new Error('User ID is required'), 'error.ai.user_id_required', lang, 400)
      );
    }
    
    // Check if user exists
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { id: true, UserName: true, isBanned: true },
    });
    
    if (!user) {
      return res.status(404).json(
        makeErrorResponse(new Error('User not found'), 'error.user.not_found', lang, 404)
      );
    }
    
    if (user.isBanned) {
      return res.status(400).json(
        makeErrorResponse(new Error('Cannot generate quests for banned user'), 'error.ai.user_banned', lang, 400)
      );
    }
    
    console.log(`[Admin] Generating weekly quests for user ${userId} (${user.UserName})`);
    const startTime = Date.now();
    
    await runWeeklyAiQuestForUser(userId, true);
    
    const elapsed = Date.now() - startTime;
    
    // Fetch generated quests
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
    console.error('[Admin] Generate weekly user error:', e);
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to generate weekly quests for user'), 'error.ai.admin_generate_failed', lang, 500)
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
      client.quest.count({ where: { type: 'Weekly', periodStatus: 'THIS_WEEK' } }),
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
    
    const completionRate = totalQuests > 0 ? Math.round((completedQuests / totalQuests) * 100) : 0;
    
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
    console.error('[Admin] Get quest stats error:', e);
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to fetch quest statistics'), 'error.ai.admin_stats_failed', lang, 500)
    );
  }
};

/**
 * ADMIN: Bulk delete quests
 */
const adminBulkDeleteQuests = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const { userId, communityId, type, periodStatus, startDate, endDate } = req.body as {
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
    
    // Validate that at least one filter is provided
    if (Object.keys(where).length === 0) {
      return res.status(400).json(
        makeErrorResponse(
          new Error('At least one filter is required (userId, communityId, type, periodStatus, or date range)'),
          'error.ai.filter_required',
          lang,
          400
        )
      );
    }
    
    console.log('[Admin] Bulk deleting quests with filters:', where);
    
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
    console.error('[Admin] Bulk delete quests error:', e);
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to delete quests'), 'error.ai.admin_delete_failed', lang, 500)
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
  // Admin functions
  adminGenerateDailyAll,
  adminGenerateDailyUser,
  adminGenerateWeeklyAll,
  adminGenerateWeeklyUser,
  adminGetQuestStats,
  adminBulkDeleteQuests,
};

export default aiController;