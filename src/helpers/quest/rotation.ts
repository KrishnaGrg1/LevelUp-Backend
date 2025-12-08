/**
 * Quest rotation logic for shifting period statuses
 */

import client from '../prisma';
import { Prisma, PeriodStatus, QuestType } from '@prisma/client';

/**
 * Rotate daily quests: TODAY → YESTERDAY → DAY_BEFORE_YESTERDAY (delete oldest)
 */
export async function rotateDailyQuests(
  userId: string,
  tx: Prisma.TransactionClient
): Promise<void> {
  // 1) Delete DAY-BEFORE-YESTERDAY
  await tx.quest.deleteMany({
    where: {
      userId,
      type: 'Daily',
      periodStatus: 'DAY_BEFORE_YESTERDAY',
    },
  });

  // 2) Move YESTERDAY → DAY-BEFORE-YESTERDAY
  await tx.quest.updateMany({
    where: {
      userId,
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
      userId,
      type: 'Daily',
      periodStatus: 'TODAY',
    },
    data: {
      periodStatus: 'YESTERDAY',
    },
  });
}

/**
 * Rotate weekly quests: THIS_WEEK → LAST_WEEK → TWO_WEEKS_AGO (delete oldest)
 */
export async function rotateWeeklyQuests(
  userId: string,
  tx: Prisma.TransactionClient
): Promise<void> {
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
    data: {
      periodStatus: 'TWO_WEEKS_AGO',
    },
  });

  // 3) Move THIS_WEEK → LAST_WEEK
  await tx.quest.updateMany({
    where: {
      userId,
      type: 'Weekly',
      periodStatus: 'THIS_WEEK',
    },
    data: {
      periodStatus: 'LAST_WEEK',
    },
  });
}

/**
 * Clean up orphaned quests (wrong periodKey for current status)
 */
export async function cleanupOrphanedQuests(
  userId: string,
  communityId: string,
  questType: QuestType,
  currentPeriodStatus: PeriodStatus,
  correctPeriodKey: string
): Promise<void> {
  await client.quest.deleteMany({
    where: {
      userId,
      type: questType,
      periodStatus: currentPeriodStatus,
      communityId,
      periodKey: { not: correctPeriodKey },
    },
  });
}
