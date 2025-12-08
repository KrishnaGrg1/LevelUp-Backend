/**
 * Quest creation utilities
 */

import { startOfDay } from 'date-fns';
import client from '../prisma';
import { Prisma, MemberStatus, QuestType, QuestSource, PeriodStatus } from '@prisma/client';

interface QuestData {
  description: string;
  xpReward?: number;
  estimatedMinutes?: number;
}

/**
 * Create quests for a community in a transaction
 */
export async function createQuestsForCommunity(
  userId: string,
  communityId: string,
  quests: QuestData[],
  questType: QuestType,
  periodStatus: PeriodStatus,
  periodKey: string,
  tx: Prisma.TransactionClient,
  effLevel: number
): Promise<void> {
  for (let i = 0; i < quests.length; i++) {
    const q = quests[i];
    const xpReward = Number.isFinite(q.xpReward)
      ? Math.max(1, Math.floor(q.xpReward!))
      : Math.max(questType === 'Daily' ? 10 : 30, effLevel * (questType === 'Daily' ? 10 : 20));
    
    const estimatedMinutes = Number.isFinite(q.estimatedMinutes)
      ? Math.max(5, Math.min(20, Math.floor(q.estimatedMinutes!)))
      : (questType === 'Daily' ? 15 : 20);

    await tx.quest.create({
      data: {
        userId,
        communityId,
        xpValue: xpReward,
        isCompleted: false,
        date: startOfDay(new Date()),
        type: questType,
        source: QuestSource.AI,
        description: q.description,
        periodStatus,
        periodKey,
        periodSeq: i + 1,
        estimatedMinutes,
      },
    });
  }
}

/**
 * Generate fallback quest descriptions
 */
export function generateFallbackQuests(
  skillName: string,
  questCount: number,
  progressive: boolean,
  questType: 'Daily' | 'Weekly',
  effLevel: number
): QuestData[] {
  if (questType === 'Daily') {
    return Array.from({ length: questCount }, (_, i) => ({
      description: progressive
        ? `(${i + 1}/${questCount}) Level up ${skillName}: attempt a slightly harder 10–15 min task building on yesterday's success.`
        : `(${i + 1}/${questCount}) Stay consistent in ${skillName}: repeat a similar 10–15 min task with clear completion criteria.`,
      xpReward: Math.max(10, effLevel * 10),
      estimatedMinutes: 15,
    }));
  } else {
    return Array.from({ length: questCount }, (_, i) => ({
      description: progressive
        ? `(${i + 1}/${questCount}) Harder weekly ${skillName} challenge with clear outcomes (15-20 min).`
        : `(${i + 1}/${questCount}) Solid ${skillName} commitment week: measurable progress (15-20 min).`,
      xpReward: Math.max(30, effLevel * 20),
      estimatedMinutes: 20,
    }));
  }
}
