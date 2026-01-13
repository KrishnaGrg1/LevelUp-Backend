// DEPRECATED: Legacy daily quest generator retained for reference. Not scheduled in current runtime.
import cron from 'node-cron';
import { startOfDay } from 'date-fns';
import client from '../helpers/prisma';
import env from '../helpers/config';
import OpenAIChat from '../helpers/ai/aiHelper';
import { getDailyQuestSetPrompt } from '../helpers/ai/prompts';
import { MemberStatus, QuestSource, QuestType } from '@prisma/client';
import { logger } from '../helpers/logger';

// ==================== LOCKS & GUARDS ====================
const locks = new Map<string, number>();
let isRunning = false;

async function acquireLock(
  key: string,
  timeoutSeconds: number
): Promise<boolean> {
  const now = Date.now();
  const existingLock = locks.get(key);

  if (existingLock && existingLock > now) {
    return false; // Lock already held
  }

  locks.set(key, now + timeoutSeconds * 1000);
  return true;
}

async function releaseLock(key: string): Promise<void> {
  locks.delete(key);
}

function ensureAIConfigured(): boolean {
  const apiKey = env.OPENAI_API_KEY as string | undefined;
  const model = env.MODEL_NAME as string | undefined;
  return Boolean(apiKey && model);
}

// ==================== AI HELPERS ====================
async function OpenAIChatWithTimeout(
  params: any,
  timeoutMs = 30000
): Promise<any> {
  return Promise.race([
    OpenAIChat(params),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI call timeout')), timeoutMs)
    ),
  ]);
}

function validateQuestResponse(parsed: any): boolean {
  if (!parsed || typeof parsed !== 'object') return false;
  if (!Array.isArray(parsed.quests)) return false;

  return parsed.quests.every(
    (q: any) =>
      q &&
      typeof q.description === 'string' &&
      q.description.length > 0 &&
      q.description.length < 500 && // Reasonable max length
      (q.xpReward === undefined || typeof q.xpReward === 'number')
  );
}

function getUserLocalComponents(tz: string) {
  try {
    const now = new Date();
    const dateKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now); // YYYY-MM-DD

    const hourStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      hour: '2-digit',
    }).format(now);

    return { dateKey, hour: parseInt(hourStr, 10) };
  } catch (error) {
    // Invalid timezone - fallback to UTC
    logger.warn(`[DailyQuest] Invalid timezone "${tz}", using UTC`);
    return getUserLocalComponents('UTC');
  }
}

// ==================== MAIN GENERATION FUNCTION ====================
async function generateQuestForUser(userId: string, force = false) {
  // ==================== LOCK ACQUISITION ====================
  const lockKey = `quest_gen:${userId}`;
  if (!(await acquireLock(lockKey, 300))) {
    console.log(
      `[DailyQuest] Generation already in progress for user ${userId}`
    );
    return;
  }

  try {
    // ==================== USER VALIDATION ====================
    const user = await client.user.findUnique({
      where: { id: userId },
      include: {
        category: true,
        CommunityMember: {
          include: { community: { include: { category: true } } },
        },
      },
    });

    if (!user) {
      console.warn(`[DailyQuest] User ${userId} not found`);
      return;
    }
    if (user.isBanned) {
      console.log(`[DailyQuest] User ${userId} is banned - skipping`);
      return;
    }
    if (!user.CommunityMember || user.CommunityMember.length === 0) {
      console.warn(
        `[DailyQuest] User ${userId} has no community memberships - skipping`
      );
      return;
    }

    // ==================== TIMEZONE & TIMING ====================
    const tz = (user as any).timezone || 'UTC';
    const { dateKey, hour } = getUserLocalComponents(tz);

    if (!force && hour !== 0) {
      return; // Only generate at midnight unless forced
    }

    // ==================== BOUNDS CHECKING ====================
    const level = Math.max(1, Math.min(user.level ?? 1, 100)); // Cap at 100
    const xp = Math.max(0, user.xp ?? 0);

    // ==================== CHECK CURRENT STATE ====================
    const currentToday = await client.quest.findFirst({
      where: {
        userId: user.id,
        type: 'Daily',
        periodStatus: 'TODAY',
      },
      orderBy: { createdAt: 'desc' },
    });

    // ==================== DETERMINE IF NEW DAY ====================
    // Key fix: Check if it's a NEW day, not if today is already generated
    const isNewDay = !currentToday || currentToday.periodKey !== dateKey;

    // Skip if already generated today (unless forced)
    if (!isNewDay && !force) {
      console.log(
        `[DailyQuest] Quests already generated for user ${userId} on ${dateKey}`
      );
      return;
    }

    // ==================== SHIFT CYCLE (ONLY IF NEW DAY) ====================
    // This ensures rotation only happens when transitioning to a new day
    if (isNewDay) {
      console.log(
        `[DailyQuest] New day detected for user ${userId}, rotating quests...`
      );

      await client.$transaction(async (tx) => {
        // 1) Delete DAY-BEFORE-YESTERDAY
        await tx.quest.deleteMany({
          where: {
            userId: user.id,
            type: 'Daily',
            periodStatus: 'DAY_BEFORE_YESTERDAY',
          },
        });

        // 2) Move YESTERDAY → DAY-BEFORE-YESTERDAY
        await tx.quest.updateMany({
          where: {
            userId: user.id,
            type: 'Daily',
            periodStatus: 'YESTERDAY',
          },
          data: {
            periodStatus: 'DAY_BEFORE_YESTERDAY',
          },
        });

        // 3) Move TODAY → YESTERDAY
        await tx.quest.updateMany({
          where: {
            userId: user.id,
            type: 'Daily',
            periodStatus: 'TODAY',
          },
          data: {
            periodStatus: 'YESTERDAY',
          },
        });
      });

      console.log(`[DailyQuest] Quest rotation completed for user ${userId}`);
    }

    // ==================== QUEST GENERATION PREP ====================
    // Use the quest that was just moved to YESTERDAY for progressive check
    const progressive = isNewDay ? Boolean(currentToday?.isCompleted) : false;
    const effLevel = progressive ? Math.min(level + 1, 100) : level;
    const QUEST_COUNT = 5;

    console.log(
      `[DailyQuest] Generating quests for user ${userId}: Level ${effLevel}, Progressive: ${progressive}`
    );

    // ==================== FALLBACK MODE ====================
    if (!ensureAIConfigured()) {
      console.log(
        `[DailyQuest] AI not configured, using fallback mode for user ${userId}`
      );

      for (const membership of user.CommunityMember) {
        // Validate community exists
        if (!membership.community) {
          console.warn(
            `[DailyQuest] Community not found for membership ${membership.id}`
          );
          continue;
        }

        // Cleanup orphaned quests (quests with TODAY status but wrong date)
        await client.quest.deleteMany({
          where: {
            userId: user.id,
            type: 'Daily',
            periodStatus: 'TODAY',
            communityId: membership.communityId,
            periodKey: { not: dateKey },
          },
        });

        const skillName =
          user.category?.[0]?.name ||
          membership.community.category?.name ||
          membership.community.name ||
          'Personal Development';

        // Validate skillName
        if (!skillName || skillName.trim() === '') {
          console.warn(
            `[DailyQuest] Invalid skill name for user ${userId}, community ${membership.communityId}`
          );
          continue;
        }

        const quests = Array.from({ length: QUEST_COUNT }, (_, i) => ({
          description: progressive
            ? `(${i + 1}/5) Level up ${skillName}: attempt a slightly harder 20–40 min task building on yesterday's success.`
            : `(${i + 1}/5) Stay consistent in ${skillName}: repeat a similar 20–40 min task with clear completion criteria.`,
          xpReward: Math.max(10, effLevel * 10),
        }));

        // Create all quests in transaction
        await client.$transaction(async (tx) => {
          for (let i = 0; i < quests.length; i++) {
            const q = quests[i];
            await tx.quest.create({
              data: {
                userId: user.id,
                communityId: membership.communityId,
                xpValue: q.xpReward,
                isCompleted: false,
                date: startOfDay(new Date()),
                type: QuestType.Daily,
                source: QuestSource.AI,
                description: q.description,
                periodStatus: 'TODAY',
                periodKey: dateKey,
                periodSeq: i + 1,
              },
            });
          }
        });

        console.log(
          `[DailyQuest] Created ${QUEST_COUNT} fallback quests for user ${userId}, community ${membership.communityId}`
        );
      }
      return;
    }

    // ==================== AI MODE ====================
    for (const membership of user.CommunityMember) {
      // Validate community exists
      if (!membership.community) {
        console.warn(
          `[DailyQuest] Community not found for membership ${membership.id}`
        );
        continue;
      }

      // Cleanup orphaned quests
      await client.quest.deleteMany({
        where: {
          userId: user.id,
          type: 'Daily',
          periodStatus: 'TODAY',
          communityId: membership.communityId,
          periodKey: { not: dateKey },
        },
      });

      const status: MemberStatus =
        (membership.status as MemberStatus) || MemberStatus.Beginner;
      const skillName =
        user.category?.[0]?.name ||
        membership.community.category?.name ||
        membership.community.name ||
        'Personal Development';

      // Validate skillName
      if (!skillName || skillName.trim() === '') {
        console.warn(
          `[DailyQuest] Invalid skill name for user ${userId}, community ${membership.communityId}`
        );
        continue;
      }

      let quests: Array<{ description: string; xpReward?: number }> = [];

      // AI generation with timeout and validation
      try {
        console.log(
          `[DailyQuest] Calling AI for user ${userId}, community ${membership.communityId}, skill: ${skillName}`
        );

        const prompt = getDailyQuestSetPrompt(skillName, effLevel, status, xp);
        const res = await OpenAIChatWithTimeout({ prompt }, 30000); // 30s timeout
        const parsed = JSON.parse(res?.content ?? '{}');

        if (validateQuestResponse(parsed)) {
          quests = parsed.quests;
          console.log(
            `[DailyQuest] AI generated ${quests.length} quests for user ${userId}`
          );
        } else {
          console.warn(
            `[DailyQuest] Invalid AI response structure for user ${userId}, using fallback`
          );
        }
      } catch (error) {
        console.error(
          `[DailyQuest] AI failed for user ${userId}, community ${membership.communityId}:`,
          error
        );
      }

      // Fallback if AI failed or returned invalid data
      if (!quests.length) {
        console.log(
          `[DailyQuest] Using fallback quests for user ${userId}, community ${membership.communityId}`
        );

        quests = Array.from({ length: QUEST_COUNT }, (_, i) => ({
          description: progressive
            ? `(${i + 1}/5) Level up ${skillName}: attempt a slightly harder 20–40 min task.`
            : `(${i + 1}/5) Stay consistent in ${skillName}: repeat a similar validated task.`,
          xpReward: Math.max(10, effLevel * 10),
        }));
      }

      // Create all quests in transaction
      await client.$transaction(async (tx) => {
        for (let i = 0; i < quests.length; i++) {
          const q = quests[i];
          const xpReward = Number.isFinite(q.xpReward)
            ? Math.max(1, Math.floor(q.xpReward!))
            : Math.max(10, effLevel * 10);

          await tx.quest.create({
            data: {
              userId: user.id,
              communityId: membership.communityId,
              xpValue: xpReward,
              isCompleted: false,
              date: startOfDay(new Date()),
              type: QuestType.Daily,
              source: QuestSource.AI,
              description: q.description,
              periodStatus: 'TODAY',
              periodKey: dateKey,
              periodSeq: i + 1,
            },
          });
        }
      });

      console.log(
        `[DailyQuest] Created ${quests.length} quests for user ${userId}, community ${membership.communityId}`
      );
    }

    console.log(
      `[DailyQuest] ✅ Quest generation completed for user ${userId}`
    );
  } catch (error) {
    console.error(
      `[DailyQuest] ❌ Generation failed for user ${userId}:`,
      error
    );
  } finally {
    await releaseLock(lockKey);
  }
}

// ====================================================================
// BATCH HANDLERS + CRON
// ====================================================================

async function runDailyQuestGenerationBatch(
  force = false,
  onlyUserId?: string
) {
  const startTime = Date.now();
  console.log(`[DailyQuest] Starting batch generation... (force: ${force})`);

  const where: any = { isBanned: false };
  if (onlyUserId) where.id = onlyUserId;

  const users = await client.user.findMany({ where, select: { id: true } });
  console.log(`[DailyQuest] Found ${users.length} users to process`);

  let successCount = 0;
  let errorCount = 0;

  for (const u of users) {
    try {
      await generateQuestForUser(u.id, force);
      successCount++;
    } catch (error) {
      errorCount++;
      console.error(`[DailyQuest] Failed to generate for user ${u.id}:`, error);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(
    `[DailyQuest] Batch completed: ${successCount} succeeded, ${errorCount} failed, ${duration}s total`
  );
}

export function startDailyAiQuestJob() {
  cron.schedule('0 * * * *', async () => {
    if (isRunning) {
      console.warn('[DailyQuest] Previous run still in progress, skipping');
      return;
    }

    console.log('[DailyQuest] Cron job triggered');
    isRunning = true;

    try {
      await runDailyQuestGenerationBatch(false);
    } catch (err) {
      console.error('[DailyQuest] Cron job error:', err);
    } finally {
      isRunning = false;
    }
  });

  console.log('✅ Daily AI Quest cron job scheduled (runs hourly at :00)');
}

export async function runDailyAiQuestNow() {
  console.log('[DailyQuest] Manual trigger: generating for all users');
  await runDailyQuestGenerationBatch(true);
}

export async function runDailyAiQuestForUser(userId: string) {
  console.log(`[DailyQuest] Manual trigger: generating for user ${userId}`);
  await runDailyQuestGenerationBatch(true, userId);
}
