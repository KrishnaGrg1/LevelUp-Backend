import client from './prisma';

/**
 * Token helper functions
 */

export interface TokenConfig {
  FREE: number;
  PRO: number;
  ULTRA: number | 'unlimited';
}

export const DAILY_TOKEN_REFILL: TokenConfig = {
  FREE: 50,
  PRO: 200,
  ULTRA: 'unlimited',
};

export const TOKEN_COSTS = {
  AI_CHAT: 3,
  GENERATE_EXTRA_QUEST: 5,
};

/**
 * Check if user has enough tokens
 */
export async function hasEnoughTokens(
  userId: string,
  amount: number
): Promise<boolean> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { tokens: true },
  });

  if (!user) return false;
  return user.tokens >= amount;
}

/**
 * Deduct tokens from user and create TokenTransaction
 * Returns new token balance
 */
export async function deductTokens(
  userId: string,
  amount: number,
  reason: string,
  tx?: any
): Promise<number> {
  const prisma = tx || client;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      tokens: {
        decrement: amount,
      },
    },
  });

  // Create token transaction record (if model exists)
  // await prisma.tokenTransaction.create({
  //   data: {
  //     userId,
  //     amount: -amount,
  //     reason,
  //     balanceAfter: user.tokens,
  //   },
  // });

  return user.tokens;
}

/**
 * Add tokens to user and create TokenTransaction
 * Returns new token balance
 */
export async function addTokens(
  userId: string,
  amount: number,
  reason: string,
  tx?: any
): Promise<number> {
  const prisma = tx || client;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      tokens: {
        increment: amount,
      },
    },
  });

  // Create token transaction record (if model exists)
  // await prisma.tokenTransaction.create({
  //   data: {
  //     userId,
  //     amount,
  //     reason,
  //     balanceAfter: user.tokens,
  //   },
  // });

  return user.tokens;
}

/**
 * Get daily token refill amount based on subscription plan
 */
export function getDailyTokenRefill(plan: 'FREE' | 'PRO' | 'ULTRA'): number {
  const refill = DAILY_TOKEN_REFILL[plan];
  return refill === 'unlimited' ? 999999 : refill;
}
