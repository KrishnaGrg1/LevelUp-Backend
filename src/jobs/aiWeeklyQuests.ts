/**
 * Weekly Quest Generation Job
 * Generates 5 weekly quests per community on Monday at user-local midnight
 */

import cron from 'node-cron';
import client from '../helpers/prisma';
import { getUserLocalComponentsWithWeekday, computeWeekKeyFromLocal } from '../helpers/quest/timezone';
import { generateQuestsWithLock } from '../helpers/quest/generator';
import logger from '../helpers/logger';

let isRunning = false;

/**
 * Generate weekly quests for a single user
 */
async function generateWeeklyQuestForUser(userId: string, force = false): Promise<void> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { id: true, timezone: true },
  });

  if (!user) return;

  const tz = (user as any).timezone || 'UTC';
  const { weekday, hour, dateKey } = getUserLocalComponentsWithWeekday(tz, '[WeeklyQuest]');
  const weekKey = computeWeekKeyFromLocal(dateKey, weekday);

  await generateQuestsWithLock({
    userId,
    force,
    questType: 'Weekly',
    periodKey: weekKey,
    hour,
    expectedHour: 0,
    expectedWeekday: 1,
    weekday,
    currentPeriodStatus: 'THIS_WEEK',
    logPrefix: '[WeeklyQuest]',
  });
}

/**
 * Run weekly quest generation for all eligible users
 */
async function runWeeklyQuestGenerationBatch(force = false, onlyUserId?: string): Promise<void> {
  const where: any = { isBanned: false };
  if (onlyUserId) where.id = onlyUserId;

  const users = await client.user.findMany({ where, select: { id: true } });
  
  for (const u of users) {
    await generateWeeklyQuestForUser(u.id, force);
  }
}

/**
 * Start the weekly quest cron job (runs every Monday at 00:00 UTC)
 */
export function startWeeklyAiQuestJob(): void {
  cron.schedule('0 0 * * 1', async () => {
    if (isRunning) {
      logger.warn('[WeeklyQuest] Previous run still in progress, skipping');
      return;
    }

    isRunning = true;
    try {
      await runWeeklyQuestGenerationBatch(false);
    } catch (e) {
      logger.error('[WeeklyQuest] Cron Error', e);
    } finally {
      isRunning = false;
    }
  });
  logger.info('✅ Weekly AI Quest cron job scheduled (Monday 00:00 UTC)');
}

/**
 * Force run weekly quest generation for all users (for manual testing)
 */
export async function runWeeklyAiQuestNow(): Promise<void> {
  await runWeeklyQuestGenerationBatch(true);
}

/**
 * Force run weekly quest generation for a specific user
 */
export async function runWeeklyAiQuestForUser(userId: string, force = false): Promise<void> {
  await runWeeklyQuestGenerationBatch(force, userId);
}
