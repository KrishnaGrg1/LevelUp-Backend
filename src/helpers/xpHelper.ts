import client from './prisma';

/**
 * XP formula: 50 * level^2
 * Calculate required XP for a given level
 */
export function getXpForLevel(level: number): number {
  return 50 * level * level;
}

/**
 * Calculate current level based on total XP
 */
export function getLevelFromXp(xp: number): number {
  let level = 1;
  while (xp >= getXpForLevel(level + 1)) {
    level++;
  }
  return level;
}

/**
 * Apply XP and maybe level up
 * Returns new XP, new level, and whether leveled up
 */
export interface XpResult {
  newXp: number;
  newLevel: number;
  leveledUp: boolean;
  xpGained: number;
}

export function applyXpAndMaybeLevelUp(
  currentXp: number,
  currentLevel: number,
  xpToAdd: number
): XpResult {
  const newXp = currentXp + xpToAdd;
  const newLevel = getLevelFromXp(newXp);
  const leveledUp = newLevel > currentLevel;

  return {
    newXp,
    newLevel,
    leveledUp,
    xpGained: xpToAdd,
  };
}

/**
 * Calculate status based on level
 */
export function getStatusFromLevel(
  level: number
): 'Beginner' | 'Intermediate' | 'Advanced' {
  if (level >= 10) return 'Advanced';
  if (level >= 5) return 'Intermediate';
  return 'Beginner';
}
