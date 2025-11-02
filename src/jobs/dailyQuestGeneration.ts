import cron from 'node-cron';
import prisma from '../helpers/prisma';
import OpenAIChat from '../helpers/ai/aiHelper';
import { QuestSource, QuestType } from '@prisma/client';

/**
 * Daily Quest Generation Cron Job
 * Runs every day at 00:05 UTC
 * Generates one daily quest for each UserSkill that doesn't have a quest for today
 */
export function scheduleDailyQuestGeneration() {
  // Run at 00:05 UTC every day
  cron.schedule('5 0 * * *', async () => {
    console.log('[CRON] Starting daily quest generation...');
    
    try {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      
      const endOfDay = new Date();
      endOfDay.setUTCHours(23, 59, 59, 999);

      // Get all UserSkills
      const userSkills = await prisma.userSkill.findMany({
        include: {
          user: true,
          skill: true,
          quests: {
            where: {
              createdAt: {
                gte: startOfDay,
                lte: endOfDay
              },
              source: QuestSource.AI,
              type: 'Daily'
            }
          }
        }
      });

      let generatedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      // For each UserSkill without a daily quest today, generate one
      for (const userSkill of userSkills) {
        // Skip if already has a daily quest today
        if (userSkill.quests.length > 0) {
          skippedCount++;
          continue;
        }

        try {
          // Generate a daily quest using AI
          const prompt = `
**Role**: You are a personalized quest generator for "${userSkill.skill.name}" skill development.

**Task**: Generate ONE realistic, actionable daily quest for a ${userSkill.status} learner at level ${userSkill.level}.

**Context**: 
- Skill: ${userSkill.skill.name}
- User Level: ${userSkill.level}
- User Status: ${userSkill.status}
- Current XP: ${userSkill.xp}

**Requirements**:
1. Quest must be completable in 15-60 minutes
2. Difficulty should match the user's current level and status
3. Must be specific and measurable
4. Include clear success criteria

**Output Format** (JSON):
{
  "description": "Detailed description with clear steps (max 500 chars)",
  "xpReward": ${Math.max(10, userSkill.level * 10)}
}

Return ONLY valid JSON, no extra text.`;

          const aiResponse = await OpenAIChat({ prompt });
          const responseContent = aiResponse.content || '';
          const questData = JSON.parse(responseContent);

          await prisma.quest.create({
            data: {
              description: questData.description,
              xpValue: questData.xpReward,
              type: QuestType.Daily,
              source: QuestSource.AI,
              userSkillId: userSkill.id,
              userId: userSkill.userId,
              date: new Date(),
            },
          });

          generatedCount++;
          console.log(`[CRON] Generated daily quest for user ${userSkill.userId}, skill ${userSkill.skill.name}`);
        } catch (error) {
          errorCount++;
          console.error(`[CRON] Failed to generate quest for UserSkill ${userSkill.id}:`, error);
        }
      }

      console.log(`[CRON] Daily quest generation complete: ${generatedCount} generated, ${skippedCount} skipped, ${errorCount} errors`);
    } catch (error) {
      console.error('[CRON] Daily quest generation failed:', error);
    }
  });

  console.log('[CRON] Daily quest generation scheduled (00:05 UTC)');
}
