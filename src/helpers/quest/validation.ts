/**
 * Common validation utilities for quest generation
 */

import logger from '../logger';

// Minimal shape needed for quest validation (avoids strict coupling to full Prisma payloads)
type UserWithRelations = {
  id: string;
  isBanned?: boolean | null;
  xp?: number | null;
  level?: number | null;
  category?: Array<{ name?: string | null }>;
  CommunityMember?: Array<{
    id: string;
    communityId: string;
    status?: any;
    role?: any;
    isPinned?: boolean;
    community?: {
      id: string;
      name?: string | null;
      isPrivate?: boolean;
      category?: { name?: string | null } | null;
    } | null;
  }>;
};

/**
 * Validate user for quest generation
 * Returns validation result and user details
 */
export function validateUser(
  user: UserWithRelations | null,
  userId: string,
  logPrefix: string
): { valid: boolean; reason?: string } {
  if (!user) {
    logger.warn(`${logPrefix} User not found`, { userId });
    return { valid: false, reason: 'not_found' };
  }

  if (user.isBanned) {
    logger.debug(`${logPrefix} User is banned - skipping`, { userId });
    return { valid: false, reason: 'banned' };
  }

  if (!user.CommunityMember || user.CommunityMember.length === 0) {
    logger.warn(`${logPrefix} User has no community memberships - skipping`, {
      userId,
    });
    return { valid: false, reason: 'no_communities' };
  }

  return { valid: true };
}

/**
 * Apply bounds checking to user level and XP
 */
export function sanitizeUserStats(level: number | null, xp: number | null) {
  return {
    level: Math.max(1, Math.min(level ?? 1, 100)), // Cap at 1-100
    xp: Math.max(0, xp ?? 0), // Non-negative
  };
}

/**
 * Get skill name from user/community with validation
 */
export function getSkillName(
  user: UserWithRelations,
  membership: any,
  logPrefix: string
): string | null {
  const skillName =
    user.category?.[0]?.name ||
    membership.community?.category?.name ||
    membership.community?.name ||
    'Personal Development';

  if (!skillName || skillName.trim() === '') {
    logger.warn(`${logPrefix} Invalid skill name`, {
      userId: user.id,
      communityId: membership.communityId,
    });
    return null;
  }

  return skillName;
}

/**
 * Validate community membership
 */
export function validateCommunity(membership: any, logPrefix: string): boolean {
  if (!membership.community) {
    logger.warn(`${logPrefix} Community not found for membership`, {
      membershipId: membership.id,
    });
    return false;
  }
  return true;
}
