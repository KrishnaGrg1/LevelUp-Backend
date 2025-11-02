import { Response } from 'express';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Language } from '../translation/translation';
import client from '../helpers/prisma';
import OpenAIChat from '../helpers/ai/aiHelper';

/**
 * Generate AI-powered quests for a user skill
 */
const generateQuests = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    const { userSkillId, count = 3, type = 'Daily' } = req.body;

    // Verify user skill belongs to the user
    const userSkill = await client.userSkill.findFirst({
      where: {
        id: userSkillId,
        userId: userId as string,
      },
      include: {
        skill: true,
      },
    });

    if (!userSkill) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('User skill not found'),
            'error.quest.skill_not_found',
            lang,
            404
          )
        );
      return;
    }

    // Check user tokens
    const user = await client.user.findUnique({
      where: { id: userId as string },
    });

    if (!user || user.tokens < count) {
      res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('Insufficient tokens'),
            'error.quest.insufficient_tokens',
            lang,
            403
          )
        );
      return;
    }

    // Generate quests using AI with structured prompt
    const xpRanges = {
      Daily: { min: 10, max: 100 },
      Weekly: { min: 100, max: 300 },
      Monthly: { min: 300, max: 1000 },
      OneTime: { min: 50, max: 500 },
    };

    const xpRange = xpRanges[type as keyof typeof xpRanges] || xpRanges.Daily;

    const prompt = `# Role
You are an expert learning path designer and quest generator for skill development platforms.

# Task
Generate ${count} ${type.toLowerCase()} quest(s) for a user learning ${userSkill.skill.name}.

# Context
- User Skill Level: ${userSkill.status}
- Current Level: ${userSkill.level}
- Quest Type: ${type}
- XP Range: ${xpRange.min}-${xpRange.max} per quest

# Requirements
1. Each quest must be practical, achievable, and directly improve ${userSkill.skill.name} skills
2. Difficulty should match ${userSkill.status} level
3. ${type} quests should have appropriate scope and time commitment
4. Quests should build upon each other progressively
5. Include variety in quest types (practice, research, build, review, etc.)

# Output Format
Return ONLY a valid JSON array with this exact structure (no markdown, no code blocks, no explanations):
[
  {
    "description": "Clear, actionable quest description",
    "xpValue": ${xpRange.min}
  }
]

# Constraints
- XP values must be between ${xpRange.min} and ${xpRange.max}
- Each description must be 10-100 characters
- Descriptions must start with an action verb
- No duplicate quest ideas
- Return ONLY the JSON array, nothing else`;

    const aiResponse = await OpenAIChat({ prompt });
    
    // Parse AI response
    let questsData: Array<{ description: string; xpValue: number }>;
    try {
      const content = aiResponse.content || '';
      // Remove any markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      questsData = JSON.parse(cleanContent);
    } catch (parseError) {
      res
        .status(500)
        .json(
          makeErrorResponse(
            new Error('Failed to parse AI response'),
            'error.quest.ai_parse_failed',
            lang,
            500
          )
        );
      return;
    }

    // Create quests in database
    const createdQuests = await Promise.all(
      questsData.map((questData) =>
        client.quest.create({
          data: {
            userId: userId as string,
            userSkillId,
            description: questData.description,
            xpValue: questData.xpValue,
            type,
            date: new Date(),
            source: 'AI',
            isCompleted: false,
          },
        })
      )
    );

    // Deduct tokens
    await client.user.update({
      where: { id: userId as string },
      data: {
        tokens: {
          decrement: count,
        },
      },
    });

    res
      .status(201)
      .json(
        makeSuccessResponse(
          { quests: createdQuests, tokensRemaining: user.tokens - count },
          'success.quest.generated',
          lang,
          201
        )
      );
    return;
  } catch (e: unknown) {
    console.error('Generate quests error:', e);
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to generate quests'),
          'error.quest.failed_to_generate',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Get all quests for the authenticated user
 */
const getMyQuests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const skip = (page - 1) * pageSize;
    const isCompleted = req.query.isCompleted === 'true' ? true : req.query.isCompleted === 'false' ? false : undefined;

    const where: any = { userId: userId as string };
    if (isCompleted !== undefined) {
      where.isCompleted = isCompleted;
    }

    const [quests, total] = await Promise.all([
      client.quest.findMany({
        where,
        include: {
          userSkill: {
            include: {
              skill: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      }),
      client.quest.count({ where }),
    ]);

    res.status(200).json(
      makeSuccessResponse(
        {
          quests,
          pagination: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
          },
        },
        'success.quest.fetch_all',
        lang,
        200
      )
    );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch quests'),
          'error.quest.failed_to_fetch',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Complete a quest and award XP
 */
const completeQuest = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    const { questId } = req.body;

    const quest = await client.quest.findFirst({
      where: {
        id: questId,
        userId: userId as string,
      },
      include: {
        userSkill: true,
      },
    });

    if (!quest) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Quest not found'),
            'error.quest.not_found',
            lang,
            404
          )
        );
      return;
    }

    if (quest.isCompleted) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Quest already completed'),
            'error.quest.already_completed',
            lang,
            400
          )
        );
      return;
    }

    // Use transaction to update quest, user XP, and userSkill XP
    const result = await client.$transaction(async (tx) => {
      // Mark quest as completed
      const updatedQuest = await tx.quest.update({
        where: { id: questId },
        data: { isCompleted: true },
      });

      // Update user XP and level
      const user = await tx.user.findUnique({
        where: { id: userId as string },
      });
      
      if (!user) throw new Error('User not found');

      const newUserXP = user.xp + quest.xpValue;
      const newUserLevel = Math.floor(newUserXP / 100) + 1; // Simple level calculation

      await tx.user.update({
        where: { id: userId as string },
        data: {
          xp: newUserXP,
          level: newUserLevel,
        },
      });

      // Update userSkill if linked
      if (quest.userSkillId && quest.userSkill) {
        const newSkillXP = quest.userSkill.xp + quest.xpValue;
        const newSkillLevel = Math.floor(newSkillXP / 100) + 1;
        
        // Determine status based on level
        let status: 'Beginner' | 'Intermediate' | 'Advanced' = 'Beginner';
        if (newSkillLevel >= 10) status = 'Advanced';
        else if (newSkillLevel >= 5) status = 'Intermediate';

        await tx.userSkill.update({
          where: { id: quest.userSkillId },
          data: {
            xp: newSkillXP,
            level: newSkillLevel,
            status,
          },
        });
      }

      // Update or create daily streak
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const streak = await tx.dailyStreak.findUnique({
        where: { userId: userId as string },
      });

      if (streak) {
        const lastUpdate = new Date(streak.updatedAt);
        lastUpdate.setHours(0, 0, 0, 0);
        
        const daysDiff = Math.floor((today.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff === 1) {
          // Consecutive day
          await tx.dailyStreak.update({
            where: { userId: userId as string },
            data: {
              count: { increment: 1 },
              updatedAt: new Date(),
            },
          });
        } else if (daysDiff > 1) {
          // Streak broken
          await tx.dailyStreak.update({
            where: { userId: userId as string },
            data: {
              count: 1,
              updatedAt: new Date(),
            },
          });
        }
        // If daysDiff === 0, it's the same day, don't update
      } else {
        // Create new streak
        await tx.dailyStreak.create({
          data: {
            userId: userId as string,
            count: 1,
          },
        });
      }

      return { updatedQuest, newUserXP, newUserLevel };
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          {
            quest: result.updatedQuest,
            xpEarned: quest.xpValue,
            newXP: result.newUserXP,
            newLevel: result.newUserLevel,
          },
          'success.quest.completed',
          lang,
          200
        )
      );
    return;
  } catch (e: unknown) {
    console.error('Complete quest error:', e);
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to complete quest'),
          'error.quest.failed_to_complete',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Create a manual quest
 */
const createManualQuest = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    const { description, xpValue, type = 'Daily', userSkillId } = req.body;

    // Verify userSkill if provided
    if (userSkillId) {
      const userSkill = await client.userSkill.findFirst({
        where: {
          id: userSkillId,
          userId: userId as string,
        },
      });

      if (!userSkill) {
        res
          .status(404)
          .json(
            makeErrorResponse(
              new Error('User skill not found'),
              'error.quest.skill_not_found',
              lang,
              404
            )
          );
        return;
      }
    }

    const newQuest = await client.quest.create({
      data: {
        userId: userId as string,
        userSkillId: userSkillId || null,
        description,
        xpValue,
        type,
        date: new Date(),
        source: 'MANUAL',
        isCompleted: false,
      },
      include: {
        userSkill: {
          include: {
            skill: true,
          },
        },
      },
    });

    res
      .status(201)
      .json(
        makeSuccessResponse(newQuest, 'success.quest.created', lang, 201)
      );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to create quest'),
          'error.quest.failed_to_create',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Delete a quest
 */
const deleteQuest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    const questId = req.params.id;

    const quest = await client.quest.findFirst({
      where: {
        id: questId,
        userId: userId as string,
      },
    });

    if (!quest) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Quest not found'),
            'error.quest.not_found',
            lang,
            404
          )
        );
      return;
    }

    await client.quest.delete({ where: { id: questId } });

    res
      .status(200)
      .json(makeSuccessResponse(null, 'success.quest.deleted', lang, 200));
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to delete quest'),
          'error.quest.failed_to_delete',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Generate an extra quest for a skill (token-protected)
 * POST /quest/generate-extra
 * Costs 5 tokens
 */
const generateExtraQuest = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    const { userSkillId } = req.body;
    const tokenCost = 5;

    // Verify user skill belongs to the user
    const userSkill = await client.userSkill.findFirst({
      where: {
        id: userSkillId,
        userId: userId as string,
      },
      include: {
        skill: true,
      },
    });

    if (!userSkill) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('User skill not found'),
            'error.quest.skill_not_found',
            lang,
            404
          )
        );
      return;
    }

    // Check user tokens
    const user = await client.user.findUnique({
      where: { id: userId as string },
    });

    if (!user || user.tokens < tokenCost) {
      // Create upsell trigger
      await client.upsellTrigger.create({
        data: {
          userId: userId as string,
          type: 'insufficient_tokens_extra_quest',
          meta: {
            tokensNeeded: tokenCost,
            tokensAvailable: user?.tokens || 0,
          },
        },
      });

      res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('Insufficient tokens'),
            'error.quest.insufficient_tokens',
            lang,
            403
          )
        );
      return;
    }

    // Generate quest using AI
    const xpRange = { min: 20, max: 100 };

    const prompt = `# Role
You are an expert quest designer for skill development.

# Task
Generate 1 bonus quest for a user learning ${userSkill.skill.name}.

# Context
- User Skill Level: ${userSkill.status}
- Current Level: ${userSkill.level}
- Quest Type: Bonus/Extra
- XP Range: ${xpRange.min}-${xpRange.max}

# Requirements
1. Quest must be practical and directly improve ${userSkill.skill.name} skills
2. Difficulty should match ${userSkill.status} level
3. Should be completable in 30-60 minutes
4. Make it interesting and engaging

# Output Format
Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "description": "Clear, actionable quest description",
  "xpValue": ${xpRange.max}
}`;

    const aiResponse = await OpenAIChat({ prompt });
    
    // Parse AI response
    let questData: { description: string; xpValue: number };
    try {
      const content = aiResponse.content || '';
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      questData = JSON.parse(cleanContent);
    } catch (parseError) {
      res
        .status(500)
        .json(
          makeErrorResponse(
            new Error('Failed to parse AI response'),
            'error.quest.ai_parse_failed',
            lang,
            500
          )
        );
      return;
    }

    // Create quest and deduct tokens in transaction
    const result = await client.$transaction(async (tx: any) => {
      const quest = await tx.quest.create({
        data: {
          userId: userId as string,
          userSkillId,
          description: questData.description,
          xpValue: questData.xpValue,
          type: 'OneTime',
          date: new Date(),
          source: 'AI',
          isCompleted: false,
        },
      });

      await tx.user.update({
        where: { id: userId as string },
        data: {
          tokens: {
            decrement: tokenCost,
          },
        },
      });

      return { quest, tokensRemaining: user.tokens - tokenCost };
    });

    res
      .status(201)
      .json(
        makeSuccessResponse(
          result,
          'success.quest.extra_generated',
          lang,
          201
        )
      );
    return;
  } catch (e: unknown) {
    console.error('Generate extra quest error:', e);
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to generate extra quest'),
          'error.quest.failed_to_generate_extra',
          lang,
          500
        )
      );
    return;
  }
};

const questController = {
  generateQuests,
  getMyQuests,
  completeQuest,
  createManualQuest,
  deleteQuest,
  generateExtraQuest,
};

export default questController;
