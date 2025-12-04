import cron from 'node-cron';
import { addDays, startOfDay } from 'date-fns';
import client from '../helpers/prisma';
import env from '../helpers/config';
import OpenAIChat from '../helpers/ai/aiHelper';
import { getDailyQuestSetPrompt } from '../helpers/ai/prompts';
import { MemberStatus, QuestSource, QuestType } from '@prisma/client';
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

function computeWeekKeyFromLocal(dateKey: string, weekday: number): string {
  // dateKey is YYYY-MM-DD in user's local calendar. Compute Monday's date as the week key.
  const [y, m, d] = dateKey.split('-').map((n) => parseInt(n, 10));
  const utcDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const daysToMonday = ((weekday + 6) % 7); // Mon=1 -> 0, Sun=0 -> 6
  const mondayUtc = new Date(utcDate.getTime() - daysToMonday * 24 * 60 * 60 * 1000);
  const mk = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(mondayUtc);
  return mk; // YYYY-MM-DD of Monday in that local week
}

function ensureAIConfigured(): boolean {
  const apiKey = env.OPENAI_API_KEY as string | undefined;
  const model = env.MODEL_NAME as string | undefined;
  return Boolean(apiKey && model);
}

async function generateWeeklyQuestForUser(userId: string, force = false) {
  const user = await client.user.findUnique({
    where: { id: userId },
    include: {
      category: true,
      CommunityMember: { include: { community: { include: { category: true } } } },
    },
  });
  if (!user) return;
  if (user.isBanned) return;

  const tz = (user as any).timezone || 'UTC';
  const { dateKey, hour, weekday } = getUserLocalComponents(tz);
  if (!force && !(hour === 0 && weekday === 1)) return; // Only run at local Monday 00:00 unless forced
  const weekKey = computeWeekKeyFromLocal(dateKey, weekday);

  const level = user.level ?? 1;
  const xp = user.xp ?? 0;

  // Fetch current THIS_WEEK quest before shifting
  const currentThisWeek = await (client as any).quest.findFirst({
    where: { userId: user.id, type: 'Weekly', periodStatus: 'THIS_WEEK' },
    orderBy: { createdAt: 'desc' },
  });

  // Check if THIS_WEEK quests already have the current weekKey (already generated this week)
  const thisWeekAlreadyGenerated = currentThisWeek && (currentThisWeek as any).periodKey === weekKey;

  if (!thisWeekAlreadyGenerated) {
    // Delete old TWO_WEEKS_AGO quests (they're no longer needed)
    await (client as any).quest.deleteMany({ 
      where: { userId: user.id, type: 'Weekly', periodStatus: 'TWO_WEEKS_AGO' } 
    });
    // Shift week statuses: LAST_WEEK->TWO_WEEKS_AGO, THIS_WEEK->LAST_WEEK
    await (client as any).quest.updateMany({ 
      where: { userId: user.id, type: 'Weekly', periodStatus: 'LAST_WEEK' }, 
      data: { periodStatus: 'TWO_WEEKS_AGO' } 
    });
    await (client as any).quest.updateMany({ 
      where: { userId: user.id, type: 'Weekly', periodStatus: 'THIS_WEEK' }, 
      data: { periodStatus: 'LAST_WEEK' } 
    });
  }

  const progressive = Boolean(currentThisWeek?.isCompleted);
  const effLevel = progressive ? (level + 1) : (level + 0);

  const count = 5;
  if (!ensureAIConfigured()) {
    for (const membership of user.CommunityMember) {
      const skillNameFallback = user.category?.name || membership?.community?.category?.name || membership?.community?.name || 'Personal Development';
      await (client as any).quest.deleteMany({ where: { userId: user.id, type: 'Weekly', source: 'AI', periodKey: weekKey, periodStatus: 'THIS_WEEK', communityId: membership.communityId } });
      for (let i = 1; i <= count; i++) {
        await (client as any).quest.create({
          data: {
            userId: user.id,
            communityId: membership.communityId,
            xpValue: Math.max(30, (effLevel + 1) * 20),
            isCompleted: false,
            date: startOfDay(new Date()),
            type: QuestType.Weekly,
            description: progressive
              ? `(${i}/5) Choose a harder ${skillNameFallback} project for this week with clear deliverables and stretch goals.`
              : `(${i}/5) Repeat a similar ${skillNameFallback} weekly project focusing on consistency and solid deliverables.`,
            source: QuestSource.AI,
            periodStatus: 'THIS_WEEK',
            periodKey: weekKey,
            periodSeq: i,
          },
        });
      }
      console.log(`[WeeklyQuest] Fallback ${count} weekly quests created for user=${user.id} community=${membership.communityId}`);
    }
    return;
  }

  for (const membership of user.CommunityMember) {
    const status: MemberStatus = (membership?.status as MemberStatus) || MemberStatus.Beginner;
    const skillName = user.category?.name || membership?.community?.category?.name || membership?.community?.name || 'Personal Development';

    // Clear only THIS_WEEK quests for this community and weekKey
    await (client as any).quest.deleteMany({ 
      where: { userId: user.id, type: 'Weekly', source: 'AI', periodKey: weekKey, periodStatus: 'THIS_WEEK', communityId: membership.communityId } 
    });

    let quests: Array<{ description: string; xpReward?: number }> = [];
    
    try {
      const prompt = getDailyQuestSetPrompt(skillName, effLevel + 1, status, xp + 20);
      const res = await OpenAIChat({ prompt });
      const content = res?.content ?? '{}';
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed?.quests)) quests = parsed.quests;
    } catch (err) {
      console.log(`[WeeklyQuest] AI failed for community=${membership.communityId}, using fallback`);
    }

    // Use fallback if AI failed or returned no quests
    if (!quests.length) {
      quests = Array.from({ length: count }, (_, idx) => ({
        description: progressive
          ? `(${idx + 1}/5) Choose a harder ${skillName} project for this week with clear deliverables and stretch goals.`
          : `(${idx + 1}/5) Repeat a similar ${skillName} weekly project focusing on consistency and solid deliverables.`,
        xpReward: Math.max(30, (effLevel + 1) * 20),
      }));
    }

    const toCreate = quests.slice(0, count);
    for (let i = 0; i < toCreate.length; i++) {
      const q = toCreate[i];
      const xpReward = Number.isFinite(q.xpReward as number) ? Math.max(1, Math.floor(q.xpReward as number)) : Math.max(30, (effLevel + 1) * 20);
      await (client as any).quest.create({
        data: {
          userId: user.id,
          communityId: membership.communityId,
          xpValue: xpReward,
          isCompleted: false,
          date: startOfDay(new Date()),
          type: QuestType.Weekly,
          description: String(q.description || ''),
          source: QuestSource.AI,
          periodStatus: 'THIS_WEEK',
          periodKey: weekKey,
          periodSeq: i + 1,
        },
      });
    }
    console.log(`[WeeklyQuest] ${toCreate.length} quests created for user=${user.id} community=${membership.communityId} skill="${skillName}"`);
  }
}

async function runWeeklyQuestGenerationBatch(force = false, onlyUserId?: string) {
  console.log(`[WeeklyQuest] ${force ? 'Forced' : 'Scheduled'} run started at ${new Date().toISOString()}${onlyUserId ? ` for user=${onlyUserId}` : ''}`);
  const where: any = { isBanned: false };
  if (onlyUserId) where.id = onlyUserId;
  const users = await client.user.findMany({ where, select: { id: true } });
  for (const u of users) {
    // eslint-disable-next-line no-await-in-loop
    await generateWeeklyQuestForUser(u.id, force);
  }
  console.log(`[WeeklyQuest] Completed ${force ? 'forced' : 'scheduled'} run for ${users.length} users`);
}

export function startWeeklyAiQuestJob() {
  // Run at 00:00 every Monday
  cron.schedule('0 0 * * 1', async () => {
    try {
      await runWeeklyQuestGenerationBatch(false);
    } catch (e) {
      console.error('[WeeklyQuest] Batch run failed', e);
    }
  });
  console.log('[WeeklyQuest] Cron scheduled for 0 0 * * 1 (Mondays)');
}

export async function runWeeklyAiQuestNow() {
  await runWeeklyQuestGenerationBatch(true);
}

export async function runWeeklyAiQuestForUser(userId: string) {
  await runWeeklyQuestGenerationBatch(true, userId);
}
