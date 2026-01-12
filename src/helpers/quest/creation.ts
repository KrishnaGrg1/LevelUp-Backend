/**
 * Quest creation utilities
 */

import { startOfDay } from 'date-fns';
import client from '../prisma';
import {
  Prisma,
  MemberStatus,
  QuestType,
  QuestSource,
  PeriodStatus,
} from '@prisma/client';

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
  communityMemberId: string,
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
      : Math.max(
          questType === 'Daily' ? 10 : 30,
          effLevel * (questType === 'Daily' ? 10 : 20)
        );

    const estimatedMinutes = Number.isFinite(q.estimatedMinutes)
      ? Math.max(5, Math.min(20, Math.floor(q.estimatedMinutes!)))
      : questType === 'Daily'
        ? 15
        : 20;

    await tx.quest.create({
      data: {
        userId,
        communityId,
        communityMemberId,
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
  // Create diverse fallback quests instead of identical ones
  const dailyQuests = [
    `Complete a beginner tutorial or lesson in ${skillName}. Take notes on 3 key concepts you learned. Time: 10 min.`,
    `Practice ${skillName} fundamentals: complete 5 simple exercises or examples. Document what worked. Time: 12 min.`,
    `Build something small using ${skillName}. Create 1 working example or mini-project. Time: 15 min.`,
    `Review and improve previous ${skillName} work. Fix 2 issues or add 2 enhancements. Time: 12 min.`,
    `Research 1 new technique in ${skillName}. Try it out and write a brief summary of results. Time: 10 min.`,
  ];

  const weeklyQuests = [
    `Create a complete mini-project in ${skillName}. Must have 3 features and be fully functional. Time: 20 min.`,
    `Study advanced ${skillName} concepts. Complete 3 challenging exercises and document solutions. Time: 18 min.`,
    `Build something practical: solve a real problem using ${skillName}. Test with real data. Time: 20 min.`,
    `Optimize existing ${skillName} work. Improve performance, add features, or refactor. Time: 15 min.`,
    `Teach ${skillName}: create a guide, tutorial, or explanation of a concept. Include examples. Time: 20 min.`,
  ];

  const questPool = questType === 'Daily' ? dailyQuests : weeklyQuests;
  const baseXp = questType === 'Daily' ? effLevel * 10 : effLevel * 20;
  const baseTime = questType === 'Daily' ? 12 : 18;

  return Array.from({ length: questCount }, (_, i) => ({
    description: questPool[i % questPool.length],
    xpReward: Math.max(questType === 'Daily' ? 10 : 30, baseXp + i * 5),
    estimatedMinutes: baseTime + i * 2,
  }));
}
