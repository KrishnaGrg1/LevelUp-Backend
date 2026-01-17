/**
 * Core quest generation logic shared between daily and weekly quests
 */

import client from '../prisma';
import { getDailyQuestSetPrompt } from '../ai/prompts';
import { MemberStatus, QuestType, PeriodStatus } from '@prisma/client';
import { acquireLock, releaseLock } from './locks';
import {
  validateUser,
  sanitizeUserStats,
  getSkillName,
  validateCommunity,
} from './validation';
import {
  ensureAIConfigured,
  OpenAIChatWithTimeout,
  validateQuestResponse,
} from './aiValidation';
import {
  rotateDailyQuests,
  rotateWeeklyQuests,
  cleanupOrphanedQuests,
} from './rotation';
import { createQuestsForCommunity, generateFallbackQuests } from './creation';
import logger from '../logger';

const QUEST_COUNT = 5;
const LOCK_TIMEOUT = 300; // 5 minutes

interface GenerateQuestsOptions {
  userId: string;
  force?: boolean;
  periodKey: string;
  questType: QuestType;
  currentPeriodStatus: PeriodStatus;
  isNewPeriod: boolean;
  effLevel: number;
  progressive: boolean;
  logPrefix: string;
}

/**
 * Generate quests for all communities a user is a member of
 */
export async function generateQuestsForAllCommunities(
  options: GenerateQuestsOptions
): Promise<void> {
  const {
    userId,
    periodKey,
    questType,
    currentPeriodStatus,
    effLevel,
    progressive,
    logPrefix,
  } = options;

  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      UserName: true,
      xp: true,
      level: true,
      tokens: true,
      isBanned: true,
      category: { select: { name: true } },
      CommunityMember: {
        select: {
          id: true,
          userId: true,
          communityId: true,
          joinedAt: true,
          totalXP: true,
          status: true,
          role: true,
          isPinned: true,
          level: true,
          community: {
            select: {
              id: true,
              name: true,
              isPrivate: true,
              category: { select: { name: true } },
              // omit inviteCode to avoid schema drift errors
            },
          },
        },
      },
    },
  });

  if (!user) {
    logger.warn(`${logPrefix} User not found`, { userId });
    return;
  }

  const aiConfigured = ensureAIConfigured();
  if (!aiConfigured) {
    logger.debug(`${logPrefix} AI not configured, using fallback mode`, {
      userId,
    });
  }

  // Only delete and regenerate if it's a new period OR if forcing regeneration
  // This prevents accumulating duplicates while preserving rotation behavior
  if (options.isNewPeriod || options.force) {
    await client.quest.deleteMany({
      where: {
        userId,
        type: questType,
        periodStatus: currentPeriodStatus,
      },
    });
  }

  // Generate quests for each community
  for (const membership of user.CommunityMember) {
    if (!validateCommunity(membership, logPrefix)) {
      continue;
    }

    const skillName = getSkillName(user, membership, logPrefix);
    if (!skillName) {
      continue;
    }

    let quests: Array<{ description: string; xpReward?: number }> = [];

    // Try AI generation if configured
    if (aiConfigured) {
      let res: any;
      try {
        const status: MemberStatus =
          (membership.status as MemberStatus) || MemberStatus.Beginner;
        const xp = Math.max(0, user.xp ?? 0);
        const promptLevel = questType === 'Weekly' ? effLevel + 1 : effLevel;
        const promptXp = questType === 'Weekly' ? xp + 20 : xp;

        logger.debug(`${logPrefix} Calling AI`, {
          userId,
          skillName,
          promptLevel,
          status,
        });
        const prompt = getDailyQuestSetPrompt(
          skillName,
          promptLevel,
          status,
          promptXp
        );
        res = await OpenAIChatWithTimeout({ prompt }, 60000); // Increased to 60 seconds

        logger.debug(`${logPrefix} AI response received`, {
          userId,
          contentLength: res?.content?.length || 0,
        });

        // Clean the response content before parsing
        let content = res?.content ?? '{}';

        // Try to extract JSON if wrapped in markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          content = jsonMatch[1];
          logger.debug(`${logPrefix} Extracted JSON from markdown code block`, {
            userId,
          });
        }

        // Remove any potential BOM or whitespace
        content = content.trim();

        const parsed = JSON.parse(content);

        if (validateQuestResponse(parsed)) {
          quests = parsed.quests;
          logger.debug(`${logPrefix} AI generated quests successfully`, {
            userId,
            count: quests.length,
          });
        } else {
          logger.warn(
            `${logPrefix} Invalid AI response structure, using fallback`,
            { userId, snippet: JSON.stringify(parsed).substring(0, 300) }
          );
        }
      } catch (error) {
        logger.error(`${logPrefix} AI failed`, error, {
          userId,
          communityId: membership.communityId,
        });
        if (error instanceof SyntaxError) {
          logger.error(`${logPrefix} JSON parse error`, error, {
            userId,
            snippet: res?.content?.substring(0, 800),
          });
        } else if (error instanceof Error) {
          logger.error(`${logPrefix} Error message`, error, { userId });
        }
      }
    }

    // Fallback if AI failed or not configured
    if (!quests.length) {
      const questTypeStr = questType === 'Daily' ? 'Daily' : 'Weekly';
      quests = generateFallbackQuests(
        skillName,
        QUEST_COUNT,
        progressive,
        questTypeStr,
        effLevel
      );
    }

    // Create all quests in transaction
    await client.$transaction(async (tx) => {
      await createQuestsForCommunity(
        userId,
        membership.communityId,
        membership.id,
        quests,
        questType,
        currentPeriodStatus,
        periodKey,
        tx,
        effLevel
      );
    });
  }
}

interface GenerationParams {
  userId: string;
  force: boolean;
  questType: QuestType;
  periodKey: string;
  hour: number;
  expectedHour: number;
  expectedWeekday: number | null;
  weekday: number | null;
  currentPeriodStatus: PeriodStatus;
  logPrefix: string;
}

/**
 * Main quest generation function with all safety measures
 */
export async function generateQuestsWithLock(
  params: GenerationParams
): Promise<void> {
  const {
    userId,
    force,
    questType,
    periodKey,
    hour,
    expectedHour,
    expectedWeekday,
    weekday,
    currentPeriodStatus,
    logPrefix,
  } = params;
  const lockKey = `quest_gen_${questType}:${userId}`;

  if (!(await acquireLock(lockKey, LOCK_TIMEOUT))) {
    logger.debug(`${logPrefix} Generation already in progress`, { userId });
    return;
  }

  try {
    // Fetch user
    // Select only fields needed to avoid hitting missing columns (e.g., Community.inviteCode on some DBs)
    const user = await client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        UserName: true,
        level: true,
        xp: true,
        tokens: true,
        isBanned: true,
        category: { select: { name: true } },
        CommunityMember: {
          select: {
            id: true,
            userId: true,
            communityId: true,
            joinedAt: true,
            totalXP: true,
            status: true,
            role: true,
            isPinned: true,
            level: true,
            community: {
              select: {
                id: true,
                name: true,
                isPrivate: true,
                category: { select: { name: true } },
                // omit inviteCode to prevent schema drift errors
              },
            },
          },
        },
      },
    });

    const validation = validateUser(user, userId, logPrefix);
    if (!validation.valid) {
      return;
    }

    // Daily token safety net: reset to 50 if below threshold during daily generation
    if (
      questType === 'Daily' &&
      user &&
      typeof user.tokens === 'number' &&
      user.tokens < 50
    ) {
      await client.user.update({
        where: { id: userId },
        data: { tokens: 50 },
      });
      logger.debug(`${logPrefix} Reset tokens to default`, {
        userId,
        previousTokens: user.tokens,
      });
    }

    // Check timing (unless forced)
    if (!force) {
      if (expectedWeekday !== null && weekday !== null) {
        // Weekly: must be Monday at midnight
        if (!(hour === expectedHour && weekday === expectedWeekday)) {
          return;
        }
      } else {
        // Daily: must be midnight
        if (hour !== expectedHour) {
          return;
        }
      }
    }

    // Sanitize user stats
    const { level, xp } = sanitizeUserStats(user!.level, user!.xp);

    // Check if new period
    const currentQuest = await client.quest.findFirst({
      where: {
        userId,
        type: questType,
        periodStatus: currentPeriodStatus,
      },
      orderBy: { createdAt: 'desc' },
    });

    const isNewPeriod = !currentQuest || currentQuest.periodKey !== periodKey;

    // Skip if already generated (unless forced)
    if (!isNewPeriod && !force) {
      logger.debug(`${logPrefix} Quests already generated`, {
        userId,
        periodKey,
      });
      return;
    }

    // Rotate quests if new period
    if (isNewPeriod) {
      logger.debug(`${logPrefix} New period detected, rotating quests`, {
        userId,
        periodKey,
      });

      await client.$transaction(async (tx) => {
        if (questType === 'Daily') {
          await rotateDailyQuests(userId, tx);
        } else {
          await rotateWeeklyQuests(userId, tx);
        }
      });

      logger.debug(`${logPrefix} Quest rotation completed`, {
        userId,
        periodKey,
      });
    }

    // Determine progression
    const progressive = isNewPeriod
      ? Boolean(currentQuest?.isCompleted)
      : false;
    const effLevel = progressive ? Math.min(level + 1, 100) : level;

    logger.debug(`${logPrefix} Generating quests`, {
      userId,
      effLevel,
      progressive,
    });

    // Generate quests
    await generateQuestsForAllCommunities({
      userId,
      force,
      periodKey,
      questType,
      currentPeriodStatus,
      isNewPeriod,
      effLevel,
      progressive,
      logPrefix,
    });
  } catch (error) {
    logger.error(`${logPrefix} Generation failed`, error, { userId });
  } finally {
    await releaseLock(lockKey);
  }
}
