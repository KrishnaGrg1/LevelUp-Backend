import cron from 'node-cron';
import { addDays, startOfDay } from 'date-fns';
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
  const weekdayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  }).format(now);
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { dateKey, hour: parseInt(hourStr, 10), weekday: weekdayMap[weekdayStr] ?? 0 };
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

  // Only attempt generation around local midnight hour to reduce load unless forced
  if (!force && hour !== 0) return;

  const level = user.level ?? 1;
  const xp = user.xp ?? 0;

  // Fetch current TODAY quest (before shifting) to decide progression
  const currentToday = await (client as any).quest.findFirst({
    where: { userId: user.id, type: 'Daily', periodStatus: 'TODAY' },
    orderBy: { createdAt: 'desc' },
  });

  // Check if TODAY quests already have the current periodKey (already generated today)
  const todayAlreadyGenerated = currentToday && (currentToday as any).periodKey === dateKey;

  if (!todayAlreadyGenerated) {
    // Delete old DAY_BEFORE_YESTERDAY quests (they're no longer needed)
    await (client as any).quest.deleteMany({
      where: { userId: user.id, type: 'Daily', periodStatus: 'DAY_BEFORE_YESTERDAY' },
    });
    // Shift statuses: YESTERDAY -> DAY_BEFORE_YESTERDAY, TODAY -> YESTERDAY
    await (client as any).quest.updateMany({
      where: { userId: user.id, type: 'Daily', periodStatus: 'YESTERDAY' },
      data: { periodStatus: 'DAY_BEFORE_YESTERDAY' },
    });
    await (client as any).quest.updateMany({
      where: { userId: user.id, type: 'Daily', periodStatus: 'TODAY' },
      data: { periodStatus: 'YESTERDAY' },
    });
  }

  // Decide difficulty bump if last TODAY quest was completed
  const progressive = Boolean(currentToday?.isCompleted);
  const effLevel = progressive ? (level + 1) : level;

  const count = 5;
  if (!ensureAIConfigured()) {
    for (const membership of user.CommunityMember) {
      const skillNameFallback =
        user.category?.name ||
        membership?.community?.category?.name ||
        membership?.community?.name ||
        'Personal Development';
      // Clear any partial 'today' creations for this community
      await (client as any).quest.deleteMany({
        where: { userId: user.id, type: 'Daily', source: 'AI', periodKey: dateKey, periodStatus: 'TODAY', communityId: membership.communityId },
      });
      for (let i = 1; i <= count; i++) {
        await (client as any).quest.create({
          data: {
            userId: user.id,
            communityId: membership.communityId,
            xpValue: Math.max(10, effLevel * 10),
            isCompleted: false,
            date: startOfDay(new Date()),
            type: QuestType.Daily,
            description: progressive
              ? `(${i}/5) Level up ${skillNameFallback}: attempt a slightly harder 20–40 min task building on yesterday's success.`
              : `(${i}/5) Stay consistent in ${skillNameFallback}: repeat a similar 20–40 min task with clear criteria to complete.`,
            source: QuestSource.AI,
            periodStatus: 'TODAY',
            periodKey: dateKey,
            periodSeq: i,
          },
        });
      }
      console.log(`[DailyQuest] Fallback ${count} quests created for user=${user.id} community=${membership.communityId}`);
    }
    return;
  }
  for (const membership of user.CommunityMember) {
    const status: MemberStatus = (membership?.status as MemberStatus) || MemberStatus.Beginner;
    const skillName =
      user.category?.name ||
      membership?.community?.category?.name ||
      membership?.community?.name ||
      'Personal Development';

    // Clear only TODAY quests for this community and periodKey
    await (client as any).quest.deleteMany({
      where: { userId: user.id, type: 'Daily', source: 'AI', periodKey: dateKey, periodStatus: 'TODAY', communityId: membership.communityId },
    });

    let quests: Array<{ description: string; xpReward?: number }> = [];
    
    try {
      const prompt = getDailyQuestSetPrompt(skillName, effLevel, status, xp);
      const res = await OpenAIChat({ prompt });
      const content = res?.content ?? '{}';
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed?.quests)) quests = parsed.quests;
    } catch (err) {
      console.log(`[DailyQuest] AI failed for community=${membership.communityId}, using fallback`);
    }

    // Use fallback if AI failed or returned no quests
    if (!quests.length) {
      quests = Array.from({ length: count }, (_, idx) => ({
        description: progressive
          ? `(${idx + 1}/5) Level up ${skillName}: attempt a slightly harder 20–40 min task building on yesterday's success.`
          : `(${idx + 1}/5) Stay consistent in ${skillName}: repeat a similar 20–40 min task with clear criteria to complete.`,
        xpReward: Math.max(10, effLevel * 10),
      }));
    }

    const toCreate = quests.slice(0, count);
    for (let i = 0; i < toCreate.length; i++) {
      const q = toCreate[i];
      const xpReward = Number.isFinite(q.xpReward as number) ? Math.max(1, Math.floor(q.xpReward as number)) : Math.max(10, effLevel * 10);
      await (client as any).quest.create({
        data: {
          userId: user.id,
          communityId: membership.communityId,
          xpValue: xpReward,
          isCompleted: false,
          date: startOfDay(new Date()),
          type: QuestType.Daily,
          description: String(q.description || ''),
          source: QuestSource.AI,
          periodStatus: 'TODAY',
          periodKey: dateKey,
          periodSeq: i + 1,
        },
      });
    }
    console.log(`[DailyQuest] ${toCreate.length} quests created for user=${user.id} community=${membership.communityId} skill="${skillName}"`);
  }
}

async function runDailyQuestGenerationBatch(force = false, onlyUserId?: string) {
  console.log(
    `[DailyQuest] ${force ? 'Forced' : 'Hourly'} run started at ${new Date().toISOString()}${onlyUserId ? ` for user=${onlyUserId}` : ''}`
  );
  const where: any = { isBanned: false };
  if (onlyUserId) where.id = onlyUserId;
  const users = await client.user.findMany({ where, select: { id: true } });
  for (const u of users) {
    // eslint-disable-next-line no-await-in-loop
    await generateQuestForUser(u.id, force);
  }
  console.log(`[DailyQuest] Completed ${force ? 'forced' : 'hourly'} run for ${users.length} users`);
}

export function startDailyAiQuestJob() {
  // Run hourly to catch user-local midnight across timezones
  cron.schedule('0 * * * *', async () => {
    try {
      await runDailyQuestGenerationBatch(false);
    } catch (e) {
      console.error('[DailyQuest] Batch run failed', e);
    }
  });
  console.log('[DailyQuest] Cron scheduled hourly at minute 0 (user-local midnight sweep)');
}

export async function runDailyAiQuestNow() {
  await runDailyQuestGenerationBatch(true);
}

export async function runDailyAiQuestForUser(userId: string) {
  await runDailyQuestGenerationBatch(true, userId);
}
