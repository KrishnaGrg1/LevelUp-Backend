import cron from 'node-cron';
import { startOfDay } from 'date-fns';
import client from '../helpers/prisma';
import env from '../helpers/config';
import OpenAIChat from '../helpers/ai/aiHelper';
import { getDailyQuestSetPrompt } from '../helpers/ai/prompts';
import { MemberStatus, QuestSource, QuestType } from '@prisma/client';

// ------------------ Local Helpers ------------------

function getUserLocalComponents(tz: string) {
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
  return Boolean(env.OPENAI_API_KEY && env.MODEL_NAME);
}

// ------------------ MAIN GENERATION ------------------

async function generateWeeklyQuestForUser(userId: string, force = false) {
  const user = await client.user.findUnique({
    where: { id: userId },
    include: {
      category: true,
      CommunityMember: {
        include: { community: { include: { category: true } } },
      },
    },
  });
  if (!user || user.isBanned) return;

  const tz = (user as any).timezone || 'UTC';
  const { weekday, hour, dateKey } = getUserLocalComponents(tz);

  // Only run at user's Monday 00:00
  if (!force && !(hour === 0 && weekday === 1)) return;

  const weekKey = computeWeekKeyFromLocal(dateKey, weekday);
  const level = user.level ?? 1;
  const xp = user.xp ?? 0;

  // ----- detect if already generated this week -----

  const currentThisWeek = await client.quest.findFirst({
    where: { userId, type: 'Weekly', periodStatus: 'THIS_WEEK' },
    orderBy: { createdAt: 'desc' },
  });

  const thisWeekAlreadyGenerated =
    currentThisWeek && currentThisWeek.periodKey === weekKey;

  // ----- SHIFT CYCLE EXACT LIKE DAILY -----
  if (!thisWeekAlreadyGenerated) {

    // 1) remove two weeks ago
    await client.quest.deleteMany({
      where: {
        userId,
        type: 'Weekly',
        periodStatus: 'TWO_WEEKS_AGO',
      },
    });

    // 2) move last week → two weeks ago
    await client.quest.updateMany({
      where: {
        userId,
        type: 'Weekly',
        periodStatus: 'LAST_WEEK',
      },
      data: { periodStatus: 'TWO_WEEKS_AGO' },
    });

    // 3) move this week → last week
    await client.quest.updateMany({
      where: {
        userId,
        type: 'Weekly',
        periodStatus: 'THIS_WEEK',
      },
      data: { periodStatus: 'LAST_WEEK' },
    });
  }

  // ----- COMPLETED (progression logic) -----
  const progressive = Boolean(currentThisWeek?.isCompleted);
  const effLevel = progressive ? level + 1 : level;

  const QUEST_COUNT = 5;

  // ------------------- FALLBACK MODE ------------------
  if (!ensureAIConfigured()) {
    for (const membership of user.CommunityMember) {
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

      for (let i = 1; i <= QUEST_COUNT; i++) {
        await client.quest.create({
          data: {
            userId,
            communityId: membership.communityId,
            xpValue: Math.max(30, effLevel * 20),
            isCompleted: false,
            date: startOfDay(new Date()),
            type: QuestType.Weekly,
            source: QuestSource.AI,
            description: progressive
              ? `(${i}/5) Harder weekly ${skill} challenge with clear outcomes.`
              : `(${i}/5) Solid ${skill} commitment week: measurable progress.`,
            periodStatus: 'THIS_WEEK',
            periodKey: weekKey,
            periodSeq: i,
          },
        });
      }
    }
    return;
  }

  // ------------------- AI MODE ------------------
  for (const membership of user.CommunityMember) {
    // remove stale THIS_WEEK quests
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

    let quests: Array<{ description: string; xpReward?: number }> = [];

    try {
      const prompt = getDailyQuestSetPrompt(skill, effLevel + 1, status, xp + 20);
      const res = await OpenAIChat({ prompt });
      const parsed = JSON.parse(res?.content ?? '{}');
      if (Array.isArray(parsed.quests)) quests = parsed.quests;
    } catch {}

    if (!quests.length) {
      quests = Array.from({ length: QUEST_COUNT }, (_, idx) => ({
        description: progressive
          ? `(${idx + 1}/5) Harder ${skill} weekly milestone challenge.`
          : `(${idx + 1}/5) Consistent ${skill} week-long execution.`,
        xpReward: Math.max(30, effLevel * 20),
      }));
    }

    for (let i = 0; i < quests.length; i++) {
      const q = quests[i];
      const xpReward = Number.isFinite(q.xpReward)
        ? Math.max(1, Math.floor(q.xpReward!))
        : Math.max(30, effLevel * 20);

      await client.quest.create({
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
    try {
      await runWeeklyQuestGenerationBatch(false);
    } catch (e) {
      console.error('[WeeklyQuest] Cron Error', e);
    }
  });
}

export async function runWeeklyAiQuestNow() {
  await runWeeklyQuestGenerationBatch(true);
}

export async function runWeeklyAiQuestForUser(userId: string) {
  await runWeeklyQuestGenerationBatch(true, userId);
}
