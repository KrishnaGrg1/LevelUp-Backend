export interface LevelProgress {
  level: number;
  xpForNext: number | null;
  xpIntoLevel: number;
  xpNeeded: number | null;
  maxLevelReached: boolean;
}

// Configurable progression curve (game-style): base 100 XP for level 1→2 and 15% growth per level
const BASE_XP = 100;
const GROWTH_RATE = 1.15;
const DEFAULT_MAX_LEVEL = 100;

/**
 * Compute level and progression given total XP using an exponential growth curve.
 * Level 1 starts at 0 XP; XP required for next level grows by GROWTH_RATE each level.
 */
export function computeLevelFromXp(
  totalXp: number,
  maxLevel: number = DEFAULT_MAX_LEVEL,
  baseXp: number = BASE_XP,
  growthRate: number = GROWTH_RATE
): LevelProgress {
  const safeXp = Math.max(0, Math.floor(totalXp || 0));
  let level = 1;
  let remainingXp = safeXp;
  let requiredForNext = Math.round(baseXp);

  while (level < maxLevel && remainingXp >= requiredForNext) {
    remainingXp -= requiredForNext;
    level += 1;
    requiredForNext = Math.round(requiredForNext * growthRate);
  }

  return {
    level,
    xpForNext: level >= maxLevel ? null : requiredForNext,
    xpIntoLevel: remainingXp,
    xpNeeded: level >= maxLevel ? null : requiredForNext - remainingXp,
    maxLevelReached: level >= maxLevel,
  };
}

export const LevelingConfig = {
  baseXp: BASE_XP,
  growthRate: GROWTH_RATE,
  maxLevel: DEFAULT_MAX_LEVEL,
};
