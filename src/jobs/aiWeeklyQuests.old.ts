import cron from 'node-cron';
import { startOfDay } from 'date-fns';
import client from '../helpers/prisma';
import env from '../helpers/config';
import OpenAIChat from '../helpers/ai/aiHelper';
import { getDailyQuestSetPrompt } from '../helpers/ai/prompts';
import { MemberStatus, QuestSource, QuestType } from '@prisma/client';

// ==================== LOCKS & GUARDS ====================
const locks = new Map<string, number>();
let isRunning = false;

async function acquireLock(key: string, timeoutSeconds: number): Promise<boolean> {
  const now = Date.now();
  const existingLock = locks.get(key);
  
  if (existingLock && existingLock > now) {
    return false;
  }
  
  locks.set(key, now + (timeoutSeconds * 1000));
  return true;
}

async function releaseLock(key: string): Promise<void> {
  locks.delete(key);
}

// ==================== AI HELPERS ====================
async function OpenAIChatWithTimeout(params: any, timeoutMs = 30000): Promise<any> {
  return Promise.race([
    OpenAIChat(params),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('AI call timeout')), timeoutMs)
    )
  ]);
}

function validateQuestResponse(parsed: any): boolean {
  if (!parsed || typeof parsed !== 'object') return false;
  if (!Array.isArray(parsed.quests)) return false;
  
  return parsed.quests.every((q: any) => 
    q && 
    typeof q.description === 'string' && 
    q.description.length > 0 &&
    q.description.length < 500 &&
    (q.xpReward === undefined || typeof q.xpReward === 'number')
  );
}

// ------------------ Local Helpers ------------------

function getUserLocalComponents(tz: string) {
  try {
    const now = new Date();
    const dateKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    const weekdayStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
    }).format(now);

    const hourStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      hour12: false,
    }).format(now);

    const weekdayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };

    return {
      dateKey,
      hour: parseInt(hourStr, 10),
      weekday: weekdayMap[weekdayStr] ?? 0,
    };
  } catch (error) {
    console.warn(`[WeeklyQuest] Invalid timezone "${tz}", using UTC`);
    return getUserLocalComponents('UTC');
  }
}

function computeWeekKeyFromLocal(dateKey: string, weekday: number) {
  // convert Mon=1 → offset=0, Sun=0 → offset=6
  const daysToMonday = (weekday + 6) % 7;

  const [y, m, d] = dateKey.split('-').map(n => parseInt(n, 10));
  const utc = new Date(Date.UTC(y, m - 1, d));
  const shift = utc.getTime() - daysToMonday * 86400000;

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(shift));
}

function ensureAIConfigured(): boolean {
  const apiKey = env.OPENAI_API_KEY as string | undefined;
  const model = env.MODEL_NAME as string | undefined;
  return Boolean(apiKey && model);
}

// ------------------ MAIN GENERATION ------------------

async function generateWeeklyQuestForUser(userId: string, force = false) {
  // ==================== LOCK ACQUISITION ====================
  const lockKey = `quest_gen_weekly:${userId}`;
  if (!await acquireLock(lockKey, 300)) {
    console.log(`[WeeklyQuest] Generation already in progress for user ${userId}`);
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
      console.warn(`[WeeklyQuest] User ${userId} not found`);
      return;
    }
    if (user.isBanned) {
      console.log(`[WeeklyQuest] User ${userId} is banned - skipping`);
      return;
    }
    if (!user.CommunityMember || user.CommunityMember.length === 0) {
      console.warn(`[WeeklyQuest] User ${userId} has no community memberships - skipping`);
      return;
    }

    // ==================== TIMEZONE & TIMING ====================
    const tz = (user as any).timezone || 'UTC';
    const { weekday, hour, dateKey } = getUserLocalComponents(tz);

    // Only run at user's Monday 00:00
    if (!force && !(hour === 0 && weekday === 1)) return;

    const weekKey = computeWeekKeyFromLocal(dateKey, weekday);

    // ==================== BOUNDS CHECKING ====================
    const level = Math.max(1, Math.min(user.level ?? 1, 100));
    const xp = Math.max(0, user.xp ?? 0);

    // ==================== CHECK CURRENT STATE ====================
    const currentThisWeek = await client.quest.findFirst({
      where: { userId, type: 'Weekly', periodStatus: 'THIS_WEEK' },
      orderBy: { createdAt: 'desc' },
    });

    // ==================== DETERMINE IF NEW WEEK ====================
    // Key fix: Check if it's a NEW week, not if this week is already generated
    const isNewWeek = !currentThisWeek || currentThisWeek.periodKey !== weekKey;
    
    // Skip if already generated this week (unless forced)
    if (!isNewWeek && !force) {
      console.log(`[WeeklyQuest] Quests already generated for user ${userId} on ${weekKey}`);
      return;
    }

    // ==================== SHIFT CYCLE (ONLY IF NEW WEEK) ====================
    // This ensures rotation only happens when transitioning to a new week
    if (isNewWeek) {
      console.log(`[WeeklyQuest] New week detected for user ${userId}, rotating quests...`);
      
      await client.$transaction(async (tx) => {
        // 1) Delete TWO_WEEKS_AGO
        await tx.quest.deleteMany({
          where: {
            userId,
            type: 'Weekly',
            periodStatus: 'TWO_WEEKS_AGO',
          },
        });

        // 2) Move LAST_WEEK → TWO_WEEKS_AGO
        await tx.quest.updateMany({
          where: {
            userId,
            type: 'Weekly',
            periodStatus: 'LAST_WEEK',
          },
          data: { periodStatus: 'TWO_WEEKS_AGO' },
        });

        // 3) Move THIS_WEEK → LAST_WEEK
        await tx.quest.updateMany({
          where: {
            userId,
            type: 'Weekly',
            periodStatus: 'THIS_WEEK',
          },
          data: { periodStatus: 'LAST_WEEK' },
        });
      });

      console.log(`[WeeklyQuest] Quest rotation completed for user ${userId}`);
    }

    // ==================== QUEST GENERATION PREP ====================
    // Use the quest that was just moved to LAST_WEEK for progressive check
    const progressive = isNewWeek ? Boolean(currentThisWeek?.isCompleted) : false;
    const effLevel = progressive ? Math.min(level + 1, 100) : level;
    const QUEST_COUNT = 5;

    console.log(`[WeeklyQuest] Generating quests for user ${userId}: Level ${effLevel}, Progressive: ${progressive}`);

    // ==================== FALLBACK MODE ====================
    if (!ensureAIConfigured()) {
      console.log(`[WeeklyQuest] AI not configured, using fallback mode for user ${userId}`);
      
      for (const membership of user.CommunityMember) {
        // Validate community exists
        if (!membership.community) {
          console.warn(`[WeeklyQuest] Community not found for membership ${membership.id}`);
          continue;
        }

        // Cleanup orphaned quests
        await client.quest.deleteMany({
          where: {
            userId,
            type: 'Weekly',
            periodStatus: 'THIS_WEEK',
            periodKey: { not: weekKey },
            communityId: membership.communityId,
          },
        });

        const skill =
          user.category?.name ||
          membership.community.category?.name ||
          membership.community.name ||
          'Personal Development';

        // Validate skill name
        if (!skill || skill.trim() === '') {
          console.warn(`[WeeklyQuest] Invalid skill name for user ${userId}, community ${membership.communityId}`);
          continue;
        }

        const quests = Array.from({ length: QUEST_COUNT }, (_, i) => ({
          description: progressive
            ? `(${i + 1}/5) Harder weekly ${skill} challenge with clear outcomes.`
            : `(${i + 1}/5) Solid ${skill} commitment week: measurable progress.`,
          xpReward: Math.max(30, effLevel * 20),
        }));

        // Create all quests in transaction
        await client.$transaction(async (tx) => {
          for (let i = 0; i < quests.length; i++) {
            const q = quests[i];
            await tx.quest.create({
              data: {
                userId,
                communityId: membership.communityId,
                xpValue: q.xpReward,
                isCompleted: false,
                date: startOfDay(new Date()),
                type: QuestType.Weekly,
                source: QuestSource.AI,
                description: q.description,
                periodStatus: 'THIS_WEEK',
                periodKey: weekKey,
                periodSeq: i + 1,
              },
            });
          }
        });
      }
      return;
    }

    // ==================== AI MODE ====================
    for (const membership of user.CommunityMember) {
      // Validate community exists
      if (!membership.community) {
        console.warn(`[WeeklyQuest] Community not found for membership ${membership.id}`);
        continue;
      }

      // Cleanup orphaned quests
      await client.quest.deleteMany({
        where: {
          userId,
          type: 'Weekly',
          periodStatus: 'THIS_WEEK',
          periodKey: { not: weekKey },
          communityId: membership.communityId,
        },
      });

      const status: MemberStatus =
        (membership.status as MemberStatus) || MemberStatus.Beginner;

      const skill =
        user.category?.name ||
        membership.community.category?.name ||
        membership.community.name ||
        'Personal Development';

      // Validate skill name
      if (!skill || skill.trim() === '') {
        console.warn(`[WeeklyQuest] Invalid skill name for user ${userId}, community ${membership.communityId}`);
        continue;
      }

      let quests: Array<{ description: string; xpReward?: number }> = [];

      // AI generation with timeout and validation
      try {
        const prompt = getDailyQuestSetPrompt(skill, effLevel + 1, status, xp + 20);
        const res = await OpenAIChatWithTimeout({ prompt }, 30000); // 30s timeout
        const parsed = JSON.parse(res?.content ?? '{}');
        
        if (validateQuestResponse(parsed)) {
          quests = parsed.quests;
        } else {
          console.warn(`[WeeklyQuest] Invalid AI response for user ${userId}, using fallback`);
        }
      } catch (error) {
        console.error(`[WeeklyQuest] AI failed for user ${userId}, community ${membership.communityId}:`, error);
      }

      // Fallback if AI failed or returned invalid data
      if (!quests.length) {
        quests = Array.from({ length: QUEST_COUNT }, (_, idx) => ({
          description: progressive
            ? `(${idx + 1}/5) Harder ${skill} weekly milestone challenge.`
            : `(${idx + 1}/5) Consistent ${skill} week-long execution.`,
          xpReward: Math.max(30, effLevel * 20),
        }));
      }

      // Create all quests in transaction
      await client.$transaction(async (tx) => {
        for (let i = 0; i < quests.length; i++) {
          const q = quests[i];
          const xpReward = Number.isFinite(q.xpReward)
            ? Math.max(1, Math.floor(q.xpReward!))
            : Math.max(30, effLevel * 20);

          await tx.quest.create({
            data: {
              userId,
              communityId: membership.communityId,
              xpValue: xpReward,
              isCompleted: false,
              date: startOfDay(new Date()),
              type: QuestType.Weekly,
              source: QuestSource.AI,
              description: q.description,
              periodStatus: 'THIS_WEEK',
              periodKey: weekKey,
              periodSeq: i + 1,
            },
          });
        }
      });
    }
  } catch (error) {
    console.error(`[WeeklyQuest] Generation failed for user ${userId}:`, error);
  } finally {
    await releaseLock(lockKey);
  }
}

async function runWeeklyQuestGenerationBatch(force = false, onlyUserId?: string) {
  const where: any = { isBanned: false };
  if (onlyUserId) where.id = onlyUserId;

  const users = await client.user.findMany({ where, select: { id: true } });
  for (const u of users) await generateWeeklyQuestForUser(u.id, force);
}

export function startWeeklyAiQuestJob() {
  cron.schedule('0 0 * * 1', async () => {
    if (isRunning) {
      console.warn('[WeeklyQuest] Previous run still in progress, skipping');
      return;
    }

    isRunning = true;
    try {
      await runWeeklyQuestGenerationBatch(false);
    } catch (e) {
      console.error('[WeeklyQuest] Cron Error', e);
    } finally {
      isRunning = false;
    }
  });
  console.log('✅ Weekly AI Quest cron job scheduled (Monday 00:00 UTC)');
}

export async function runWeeklyAiQuestNow() {
  await runWeeklyQuestGenerationBatch(true);
}

export async function runWeeklyAiQuestForUser(userId: string) {
  await runWeeklyQuestGenerationBatch(true, userId);
}
