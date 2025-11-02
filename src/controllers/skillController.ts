import { Response } from 'express';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Language } from '../translation/translation';
import client from '../helpers/prisma';

/**
 * Create a new skill (Admin only)
 */
const createSkill = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const { name, slug, description, icon, isPremium } = req.body;

    // Check if skill already exists
    const existingSkill = await client.skill.findFirst({
      where: {
        OR: [{ name }, { slug: slug || name.toLowerCase().replace(/\s+/g, '-') }],
      },
    });

    if (existingSkill) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Skill with this name or slug already exists'),
            'error.skill.already_exists',
            lang,
            400
          )
        );
      return;
    }

    const newSkill = await client.skill.create({
      data: {
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
        description,
        icon,
        isPremium: isPremium || false,
      },
    });

    res
      .status(201)
      .json(
        makeSuccessResponse(newSkill, 'success.skill.created', lang, 201)
      );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to create skill'),
          'error.skill.failed_to_create',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Get all skills
 */
const getAllSkills = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const skip = (page - 1) * pageSize;

    const [skills, total] = await Promise.all([
      client.skill.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      }),
      client.skill.count(),
    ]);

    res.status(200).json(
      makeSuccessResponse(
        {
          skills,
          pagination: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
          },
        },
        'success.skill.fetch_all',
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
          new Error('Failed to fetch skills'),
          'error.skill.failed_to_fetch',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Get skill by ID
 */
const getSkillById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const skillId = req.params.id;

    const skill = await client.skill.findUnique({
      where: { id: skillId },
      include: {
        _count: {
          select: { userSkills: true },
        },
      },
    });

    if (!skill) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Skill not found'),
            'error.skill.not_found',
            lang,
            404
          )
        );
      return;
    }

    res
      .status(200)
      .json(makeSuccessResponse(skill, 'success.skill.fetch', lang, 200));
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch skill'),
          'error.skill.failed_to_fetch',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Update skill (Admin only)
 */
const updateSkill = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const skillId = req.params.id;
    const { name, slug, description, icon, isPremium } = req.body;

    const skill = await client.skill.findUnique({ where: { id: skillId } });

    if (!skill) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Skill not found'),
            'error.skill.not_found',
            lang,
            404
          )
        );
      return;
    }

    const updatedSkill = await client.skill.update({
      where: { id: skillId },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(description && { description }),
        ...(icon && { icon }),
        ...(isPremium !== undefined && { isPremium }),
      },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(updatedSkill, 'success.skill.updated', lang, 200)
      );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to update skill'),
          'error.skill.failed_to_update',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Delete skill (Admin only)
 */
const deleteSkill = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const skillId = req.params.id;

    const skill = await client.skill.findUnique({ where: { id: skillId } });

    if (!skill) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Skill not found'),
            'error.skill.not_found',
            lang,
            404
          )
        );
      return;
    }

    await client.skill.delete({ where: { id: skillId } });

    res
      .status(200)
      .json(makeSuccessResponse(null, 'success.skill.deleted', lang, 200));
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to delete skill'),
          'error.skill.failed_to_delete',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Enroll user in a skill (create UserSkill)
 */
const enrollInSkill = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    const { skillId } = req.body;

    // Check if skill exists
    const skill = await client.skill.findUnique({ where: { id: skillId } });

    if (!skill) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Skill not found'),
            'error.skill.not_found',
            lang,
            404
          )
        );
      return;
    }

    // Check if user is already enrolled
    const existingEnrollment = await client.userSkill.findUnique({
      where: {
        userId_skillId: {
          userId: userId as string,
          skillId,
        },
      },
    });

    if (existingEnrollment) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Already enrolled in this skill'),
            'error.skill.already_enrolled',
            lang,
            400
          )
        );
      return;
    }

    // Check if skill is premium and user has access
    if (skill.isPremium) {
      const subscription = await client.subscription.findUnique({
        where: { userId: userId as string },
      });

      if (!subscription || subscription.plan === 'FREE') {
        res
          .status(403)
          .json(
            makeErrorResponse(
              new Error('Premium subscription required'),
              'error.skill.premium_required',
              lang,
              403
            )
          );
        return;
      }
    }

    // Create enrollment
    const userSkill = await client.userSkill.create({
      data: {
        userId: userId as string,
        skillId,
        level: 1,
        xp: 0,
        status: 'Beginner',
      },
      include: {
        skill: true,
      },
    });

    res
      .status(201)
      .json(
        makeSuccessResponse(userSkill, 'success.skill.enrolled', lang, 201)
      );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to enroll in skill'),
          'error.skill.failed_to_enroll',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Get user's enrolled skills
 */
const getMySkills = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;

    const userSkills = await client.userSkill.findMany({
      where: { userId: userId as string },
      include: {
        skill: true,
        _count: {
          select: { quests: true },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(userSkills, 'success.skill.fetch_my_skills', lang, 200)
      );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch user skills'),
          'error.skill.failed_to_fetch',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Get specific user skill by ID
 */
const getUserSkillById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    const userSkillId = req.params.id;

    const userSkill = await client.userSkill.findFirst({
      where: {
        id: userSkillId,
        userId: userId as string,
      },
      include: {
        skill: true,
        quests: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!userSkill) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('User skill not found'),
            'error.skill.not_found',
            lang,
            404
          )
        );
      return;
    }

    res
      .status(200)
      .json(
        makeSuccessResponse(userSkill, 'success.skill.fetch', lang, 200)
      );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch user skill'),
          'error.skill.failed_to_fetch',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Select multiple skills during onboarding
 * POST /onboarding/select-skills
 */
const selectSkills = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    const { skillIds, initialStatus } = req.body;

    if (!userId) {
      res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
      return;
    }

    // Verify all skills exist
    const skills = await client.skill.findMany({
      where: {
        id: {
          in: skillIds,
        },
      },
    });

    if (skills.length !== skillIds.length) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('One or more skills not found'),
            'error.skill.not_found',
            lang,
            400
          )
        );
      return;
    }

    // Upsert UserSkill entries
    const userSkills = await Promise.all(
      skillIds.map((skillId: string) =>
        client.userSkill.upsert({
          where: {
            userId_skillId: {
              userId,
              skillId,
            },
          },
          create: {
            userId,
            skillId,
            status: initialStatus || 'Beginner',
            level: 1,
            xp: 0,
          },
          update: {
            // If already exists, optionally update status
            status: initialStatus || undefined,
          },
          include: {
            skill: true,
          },
        })
      )
    );

    res
      .status(200)
      .json(
        makeSuccessResponse(
          { userSkills, count: userSkills.length },
          'success.skill.selected',
          lang,
          200
        )
      );
    return;
  } catch (e: unknown) {
    console.error('Select skills error:', e);
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to select skills'),
          'error.skill.failed_to_select',
          lang,
          500
        )
      );
    return;
  }
};

const skillController = {
  createSkill,
  getAllSkills,
  getSkillById,
  updateSkill,
  deleteSkill,
  enrollInSkill,
  getMySkills,
  getUserSkillById,
  selectSkills,
};

export default skillController;
