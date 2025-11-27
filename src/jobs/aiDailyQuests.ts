import cron from 'node-cron';
import { addDays, startOfDay } from 'date-fns';
import client from '../helpers/prisma';
import env from '../helpers/config';
import OpenAIChat from '../helpers/ai/aiHelper';
import { getDailyQuestPrompt } from '../helpers/ai/prompts';
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

async function generateQuestForUser(userId: string) {
  const user = await client.user.findUnique({
    where: { id: userId },
    include: {
      category: true,
      CommunityMember: {
        take: 1,
        include: { community: { include: { category: true } } },
      },
    },
  });
  if (!user) return;
  if (user.isBanned) return;

  const tz = (user as any).timezone || 'UTC';
  const { dateKey, hour } = getUserLocalComponents(tz);

  // Only attempt generation around local midnight hour to reduce load
  if (hour !== 0) return;

  // If today's daily already exists for this user (by periodKey), skip
  const existing = await (client as any).quest.findFirst({
    where: { userId: user.id, type: 'Daily', source: 'AI', periodKey: dateKey },
    select: { id: true },
  });
  if (existing) return;

  const membership = user.CommunityMember?.[0];
  const status: MemberStatus = (membership?.status as MemberStatus) || MemberStatus.Beginner;
  const level = user.level ?? 1;
  const xp = user.xp ?? 0;
  const skillName =
    user.category?.name ||
    membership?.community?.category?.name ||
    membership?.community?.name ||
    'Personal Development';

  // Fetch current TODAY quest (before shifting) to decide progression
  const currentToday = await (client as any).quest.findFirst({
    where: { userId: user.id, type: 'Daily', periodStatus: 'TODAY' },
    orderBy: { createdAt: 'desc' },
  });

  // Shift statuses: TODAY -> YESTERDAY, YESTERDAY -> DAY_BEFORE_YESTERDAY, DAY_BEFORE_YESTERDAY -> NONE
  await (client as any).quest.updateMany({
    where: { userId: user.id, type: 'Daily', periodStatus: 'DAY_BEFORE_YESTERDAY' },
    data: { periodStatus: 'NONE' },
  });
  await (client as any).quest.updateMany({
    where: { userId: user.id, type: 'Daily', periodStatus: 'YESTERDAY' },
    data: { periodStatus: 'DAY_BEFORE_YESTERDAY' },
  });
  await (client as any).quest.updateMany({
    where: { userId: user.id, type: 'Daily', periodStatus: 'TODAY' },
    data: { periodStatus: 'YESTERDAY' },
  });

  // Decide difficulty bump if last TODAY quest was completed
  const progressive = Boolean(currentToday?.isCompleted);
  const effLevel = progressive ? (level + 1) : level;

  if (!ensureAIConfigured()) {
    await (client as any).quest.create({
      data: {
        userId: user.id,
        xpValue: Math.max(10, effLevel * 10),
        isCompleted: false,
        date: startOfDay(new Date()),
        type: QuestType.Daily,
        description: progressive
          ? `Level up ${skillName}: attempt a slightly harder 20–40 min task building on yesterday's success.`
          : `Stay consistent in ${skillName}: repeat a similar 20–40 min task with clear criteria to complete.`,
        source: QuestSource.AI,
        periodStatus: 'TODAY',
        periodKey: dateKey,
      },
    });
    console.log(`[DailyQuest] Fallback quest created for user=${user.id} skill=\"${skillName}\" progressive=${progressive}`);
    return;
  }
  const prompt = getDailyQuestPrompt(skillName, effLevel, status, xp);
  try {
    const message = await OpenAIChat({ prompt });
    const content = message?.content ?? '{}';
    let description = '';
    let xpReward = Math.max(10, effLevel * 10);
    try {
      const parsed = JSON.parse(content);
      description = String(parsed.description ?? '');
      xpReward = Number(parsed.xpReward ?? xpReward);
    } catch {
      description = progressive
        ? `Level up ${skillName}: attempt a slightly harder 20–40 min task building on yesterday's success.`
        : `Stay consistent in ${skillName}: repeat a similar 20–40 min task with clear criteria to complete.`;
    }

    if (!description || description.trim().length < 10) {
      description = `Focus on ${skillName}: complete a specific 20–40 min task with clear success criteria.`;
    }

    await (client as any).quest.create({
      data: {
        userId: user.id,
        xpValue: Number.isFinite(xpReward) ? Math.max(1, Math.floor(xpReward)) : Math.max(10, effLevel * 10),
        isCompleted: false,
        date: startOfDay(new Date()),
        type: QuestType.Daily,
        description,
        source: QuestSource.AI,
        periodStatus: 'TODAY',
        periodKey: dateKey,
      },
    });
    console.log(`[DailyQuest] AI quest created for user=${user.id} skill="${skillName}"`);
  } catch (err) {
    console.error(`[DailyQuest] AI generation failed for user=${user.id}`, err);
  }
}

async function runDailyQuestGenerationBatch() {
  console.log(`[DailyQuest] Hourly sweep for user-local midnights started at ${new Date().toISOString()}`);
  const users = await client.user.findMany({ where: { isBanned: false }, select: { id: true } });
  for (const u of users) {
    // eslint-disable-next-line no-await-in-loop
    await generateQuestForUser(u.id);
  }
  console.log(`[DailyQuest] Completed hourly sweep for ${users.length} users`);
}

export function startDailyAiQuestJob() {
  // Run hourly to catch user-local midnight across timezones
  cron.schedule('0 * * * *', async () => {
    try {
      await runDailyQuestGenerationBatch();
    } catch (e) {
      console.error('[DailyQuest] Batch run failed', e);
    }
  });
  console.log('[DailyQuest] Cron scheduled hourly at minute 0 (user-local midnight sweep)');
}

export async function runDailyAiQuestNow() {
  await runDailyQuestGenerationBatch();
}
