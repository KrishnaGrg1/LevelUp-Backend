import cron from 'node-cron';
import { startOfDay } from 'date-fns';
import client from '../helpers/prisma';
import env from '../helpers/config';
import OpenAIChat from '../helpers/ai/aiHelper';
import { getDailyQuestSetPrompt } from '../helpers/ai/prompts';
import { MemberStatus, QuestSource, QuestType } from '@prisma/client';

function ensureAIConfigured(): boolean {
  const apiKey = env.OPENAI_API_KEY as string | undefined;
  const model = env.MODEL_NAME as string | undefined;
  return Boolean(apiKey && model);
}

function getUserLocalComponents(tz: string) {
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
}

async function generateQuestForUser(userId: string, force = false) {
  const user = await client.user.findUnique({
    where: { id: userId },
    include: {
      category: true,
      CommunityMember: {
        include: { community: { include: { category: true } } },
      },
    },
  });
  if (!user) return;
  if (user.isBanned) return;

  const tz = (user as any).timezone || 'UTC';
  const { dateKey, hour } = getUserLocalComponents(tz);

  if (!force && hour !== 0) return;

  const level = user.level ?? 1;
  const xp = user.xp ?? 0;

  const currentToday = await client.quest.findFirst({
    where: {
      userId: user.id,
      type: 'Daily',
      periodStatus: 'TODAY',
    },
    orderBy: { createdAt: 'desc' },
  });

  const todayAlreadyGenerated =
    currentToday && currentToday.periodKey === dateKey;

  // -------------------------------------------------------
  // SHIFT CYCLE
  // -------------------------------------------------------
  if (!todayAlreadyGenerated) {
    // 1) Delete DAY-BEFORE-YESTERDAY
    await client.quest.deleteMany({
      where: {
        userId: user.id,
        type: 'Daily',
        periodStatus: 'DAY_BEFORE_YESTERDAY',
      },
    });

    // 2) Move YESTERDAY → DAY-BEFORE-YESTERDAY
    await client.quest.updateMany({
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
    await client.quest.updateMany({
      where: {
        userId: user.id,
        type: 'Daily',
        periodStatus: 'TODAY',
      },
      data: {
        periodStatus: 'YESTERDAY',
      },
    });
  }
  // -------------------------------------------------------

  const progressive = Boolean(currentToday?.isCompleted);
  const effLevel = progressive ? level + 1 : level;
  const QUEST_COUNT = 5;

  // =======================================================
  // ✨ GENERATE NEW TODAY QUESTS (Fallback Mode)
  // =======================================================
  if (!ensureAIConfigured()) {
    for (const membership of user.CommunityMember) {
      // Delete ONLY old TODAY quests NOT belonging to current date
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
        user.category?.name ||
        membership.community.category?.name ||
        membership.community.name ||
        'Personal Development';

      for (let i = 1; i <= QUEST_COUNT; i++) {
        await client.quest.create({
          data: {
            userId: user.id,
            communityId: membership.communityId,
            xpValue: Math.max(10, effLevel * 10),
            isCompleted: false,
            date: startOfDay(new Date()),
            type: QuestType.Daily,
            source: QuestSource.AI,
            description: progressive
              ? `(${i}/5) Level up ${skillName}: attempt a slightly harder 20–40 min task building on yesterday's success.`
              : `(${i}/5) Stay consistent in ${skillName}: repeat a similar 20–40 min task with clear completion criteria.`,
            periodStatus: 'TODAY',
            periodKey: dateKey,
            periodSeq: i,
          },
        });
      }
    }
    return;
  }

  // =======================================================
  // 🚀 GENERATE NEW TODAY QUESTS (AI Mode)
  // =======================================================
  for (const membership of user.CommunityMember) {
    // Delete ONLY old TODAY quests NOT belonging to current date
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
      user.category?.name ||
      membership.community.category?.name ||
      membership.community.name ||
      'Personal Development';

    let quests: Array<{ description: string; xpReward?: number }> = [];
    try {
      const prompt = getDailyQuestSetPrompt(skillName, effLevel, status, xp);
      const res = await OpenAIChat({ prompt });
      const parsed = JSON.parse(res?.content ?? '{}');
      if (Array.isArray(parsed.quests)) quests = parsed.quests;
    } catch {}

    if (!quests.length) {
      quests = Array.from({ length: QUEST_COUNT }, (_, i) => ({
        description: progressive
          ? `(${i + 1}/5) Level up ${skillName}: attempt a slightly harder 20–40 min task.`
          : `(${i + 1}/5) Stay consistent in ${skillName}: repeat a similar validated task.`,
        xpReward: Math.max(10, effLevel * 10),
      }));
    }

    for (let i = 0; i < quests.length; i++) {
      const q = quests[i];
      const xpReward = Number.isFinite(q.xpReward)
        ? Math.max(1, Math.floor(q.xpReward!))
        : Math.max(10, effLevel * 10);

      await client.quest.create({
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
  }
}

// ====================================================================
// BATCH HANDLERS + CRON
// ====================================================================

async function runDailyQuestGenerationBatch(force = false, onlyUserId?: string) {
  const where: any = { isBanned: false };
  if (onlyUserId) where.id = onlyUserId;

  const users = await client.user.findMany({ where, select: { id: true } });
  for (const u of users) {
    await generateQuestForUser(u.id, force);
  }
}

export function startDailyAiQuestJob() {
  cron.schedule('0 * * * *', async () => {
    try {
      await runDailyQuestGenerationBatch(false);
    } catch (err) {
      console.error('[DailyQuest] Error', err);
    }
  });
}

export async function runDailyAiQuestNow() {
  await runDailyQuestGenerationBatch(true);
}

export async function runDailyAiQuestForUser(userId: string) {
  await runDailyQuestGenerationBatch(true, userId);
}
