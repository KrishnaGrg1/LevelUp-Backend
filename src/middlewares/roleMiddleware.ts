import { Response, NextFunction } from 'express';
import client from '../helpers/prisma';
import { AuthRequest } from './authMiddleware';
import { makeErrorResponse } from '../helpers/standardResponse';
import { Language } from '../translation/translation';
import { Role } from '@prisma/client';

/**
 * Middleware factory to check if a user has the required role(s)
 * in a specific community.
 *
 * Usage:
 * router.post('/:communityId/something', checkRole(['ADMIN', 'OWNER']), handler)
 */
export const checkRole = (allowedRoles: Role[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const lang = req.language as Language;
      const userId = req.user?.id;
      const communityId = req.params.communityId;

      if (!userId) {
        return res
          .status(401)
          .json(
            makeErrorResponse(
              new Error('Not authenticated'),
              'error.auth.not_authenticated',
              lang,
              401
            )
          );
      }

      if (!communityId) {
        return res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('Community ID missing'),
              'error.community.missing_id',
              lang,
              400
            )
          );
      }

      // Check if user is part of the community
      const membership = await client.communityMember.findUnique({
        where: {
          userId_communityId: {
            userId,
            communityId: communityId,
          },
        },
      });

      if (!membership) {
        return res
          .status(403)
          .json(
            makeErrorResponse(
              new Error('Not a member of this community'),
              'error.community.not_member',
              lang,
              403
            )
          );
      }

      // Check if user has one of the allowed roles
      if (!allowedRoles.includes(membership.role)) {
        return res
          .status(403)
          .json(
            makeErrorResponse(
              new Error('Access denied'),
              'error.auth.forbidden',
              lang,
              403
            )
          );
      }

      next();
    } catch (error) {
      const lang = (req.language as Language) || 'eng';
      return res
        .status(500)
        .json(
          makeErrorResponse(
            new Error('Role check failed'),
            'error.auth.role_check_failed',
            lang,
            500
          )
        );
    }
  };
};
