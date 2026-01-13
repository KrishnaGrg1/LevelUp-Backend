/**
 * Daily Quest Generation Job
 * Generates 5 daily quests per community at user-local midnight
 */

import cron from 'node-cron';
import client from '../helpers/prisma';
import { getUserLocalComponents } from '../helpers/quest/timezone';
import { generateQuestsWithLock } from '../helpers/quest/generator';
import logger from '../helpers/logger';

let isRunning = false;

/**
 * Generate daily quests for a single user
 */
async function generateDailyQuestForUser(
  userId: string,
  force = false
): Promise<void> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { id: true, timezone: true },
  });

  if (!user) return;

  const tz = (user as any).timezone || 'UTC';
  const { dateKey, hour } = getUserLocalComponents(tz, '[DailyQuest]');

  await generateQuestsWithLock({
    userId,
    force,
    questType: 'Daily',
    periodKey: dateKey,
    hour,
    expectedHour: 0,
    expectedWeekday: null,
    weekday: null,
    currentPeriodStatus: 'TODAY',
    logPrefix: '[DailyQuest]',
  });
}

/**
 * Run daily quest generation for all eligible users
 */
async function runDailyQuestGenerationBatch(
  force = false,
  onlyUserId?: string
): Promise<void> {
  const where: any = { isBanned: false };
  if (onlyUserId) where.id = onlyUserId;

  const users = await client.user.findMany({ where, select: { id: true } });

  for (const u of users) {
    await generateDailyQuestForUser(u.id, force);
  }
}

/**
 * Start the daily quest cron job (runs every hour, checks for midnight)
 */
export function startDailyAiQuestJob(): void {
  cron.schedule('0 * * * *', async () => {
    if (isRunning) {
      logger.warn('[DailyQuest] Previous run still in progress, skipping');
      return;
    }

    isRunning = true;
    try {
      await runDailyQuestGenerationBatch(false);
    } catch (err) {
      logger.error('[DailyQuest] Error', err);
    } finally {
      isRunning = false;
    }
  });
  logger.info('✅ Daily AI Quest cron job scheduled (hourly)');
}

/**
 * Force run daily quest generation for all users (for manual testing)
 */
export async function runDailyAiQuestNow(): Promise<void> {
  await runDailyQuestGenerationBatch(true);
}

/**
 * Force run daily quest generation for a specific user
 */
export async function runDailyAiQuestForUser(
  userId: string,
  force = false
): Promise<void> {
  await runDailyQuestGenerationBatch(force, userId);
}
