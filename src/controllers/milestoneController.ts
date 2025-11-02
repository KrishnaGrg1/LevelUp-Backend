import { Response } from 'express';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Language } from '../translation/translation';
import client from '../helpers/prisma';

/**
 * Create a new milestone (Admin only)
 */
const createMilestone = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const { name, description, xpReward } = req.body;

    const milestone = await client.milestone.create({
      data: {
        name,
        description,
        xpReward: xpReward || 0,
      },
    });

    res
      .status(201)
      .json(
        makeSuccessResponse(milestone, 'success.milestone.created', lang, 201)
      );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to create milestone'),
          'error.milestone.failed_to_create',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Get all milestones
 */
const getAllMilestones = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';

    const milestones = await client.milestone.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { UserMilestone: true },
        },
      },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          milestones,
          'success.milestone.fetch_all',
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
          new Error('Failed to fetch milestones'),
          'error.milestone.failed_to_fetch',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Get user's achieved milestones
 */
const getMyMilestones = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;

    const userMilestones = await client.userMilestone.findMany({
      where: { userId: userId as string },
      include: {
        milestone: true,
      },
      orderBy: { achievedAt: 'desc' },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          userMilestones,
          'success.milestone.fetch_my_milestones',
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
          new Error('Failed to fetch user milestones'),
          'error.milestone.failed_to_fetch',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Achieve a milestone
 */
const achieveMilestone = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    const milestoneId = req.params.id;

    // Check if milestone exists
    const milestone = await client.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Milestone not found'),
            'error.milestone.not_found',
            lang,
            404
          )
        );
      return;
    }

    // Check if already achieved
    const existingAchievement = await client.userMilestone.findFirst({
      where: {
        userId: userId as string,
        milestoneId,
      },
    });

    if (existingAchievement) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Milestone already achieved'),
            'error.milestone.already_achieved',
            lang,
            400
          )
        );
      return;
    }

    // Award milestone and XP in transaction
    const result = await client.$transaction(async (tx) => {
      const userMilestone = await tx.userMilestone.create({
        data: {
          userId: userId as string,
          milestoneId,
        },
        include: {
          milestone: true,
        },
      });

      // Award XP to user
      if (milestone.xpReward > 0) {
        const user = await tx.user.findUnique({
          where: { id: userId as string },
        });

        if (user) {
          const newXP = user.xp + milestone.xpReward;
          const newLevel = Math.floor(newXP / 100) + 1;

          await tx.user.update({
            where: { id: userId as string },
            data: {
              xp: newXP,
              level: newLevel,
            },
          });
        }
      }

      return userMilestone;
    });

    res
      .status(201)
      .json(
        makeSuccessResponse(
          result,
          'success.milestone.achieved',
          lang,
          201
        )
      );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to achieve milestone'),
          'error.milestone.failed_to_achieve',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Update milestone (Admin only)
 */
const updateMilestone = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const milestoneId = req.params.id;
    const { name, description, xpReward } = req.body;

    const milestone = await client.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Milestone not found'),
            'error.milestone.not_found',
            lang,
            404
          )
        );
      return;
    }

    const updatedMilestone = await client.milestone.update({
      where: { id: milestoneId },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(xpReward !== undefined && { xpReward }),
      },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          updatedMilestone,
          'success.milestone.updated',
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
          new Error('Failed to update milestone'),
          'error.milestone.failed_to_update',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Delete milestone (Admin only)
 */
const deleteMilestone = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const milestoneId = req.params.id;

    const milestone = await client.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Milestone not found'),
            'error.milestone.not_found',
            lang,
            404
          )
        );
      return;
    }

    await client.milestone.delete({ where: { id: milestoneId } });

    res
      .status(200)
      .json(
        makeSuccessResponse(null, 'success.milestone.deleted', lang, 200)
      );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to delete milestone'),
          'error.milestone.failed_to_delete',
          lang,
          500
        )
      );
    return;
  }
};

const milestoneController = {
  createMilestone,
  getAllMilestones,
  getMyMilestones,
  achieveMilestone,
  updateMilestone,
  deleteMilestone,
};

export default milestoneController;
