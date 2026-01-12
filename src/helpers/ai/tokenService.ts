import client from '../prisma';
import env from '../config';
import logger from '../logger';

const parsedCost = Number(env.AI_TOKEN_COST_PER_CHAT ?? 1);
const TOKEN_COST_PER_CHAT =
  Number.isFinite(parsedCost) && parsedCost > 0 ? parsedCost : 1;

export const getTokenCostPerChat = () => TOKEN_COST_PER_CHAT;

export type ConsumeTokensResult =
  | { ok: true; remainingTokens: number; cost: number }
  | {
      ok: false;
      remainingTokens: number;
      cost: number;
      reason: 'insufficient';
    };

export async function getTokenBalance(userId: string): Promise<number> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { tokens: true },
  });
  return user?.tokens ?? 0;
}

/**
 * Atomically consume tokens for AI usage. Prevents negative balances under concurrency.
 */
export async function consumeTokens(
  userId: string,
  cost: number = TOKEN_COST_PER_CHAT
): Promise<ConsumeTokensResult> {
  return client.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: userId, tokens: { gte: cost } },
      data: { tokens: { decrement: cost } },
    });

    if (updated.count === 0) {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { tokens: true },
      });
      if (!user) {
        logger.warn('[AI Tokens] User not found while consuming tokens', {
          userId,
          cost,
        });
        throw new Error('USER_NOT_FOUND');
      }

      return {
        ok: false,
        remainingTokens: user.tokens,
        cost,
        reason: 'insufficient',
      } as const;
    }

    const refreshed = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { tokens: true },
    });
    return { ok: true, remainingTokens: refreshed.tokens, cost } as const;
  });
}

/**
 * Refund tokens in case downstream AI work fails after a successful debit.
 */
export async function refundTokens(
  userId: string,
  amount: number = TOKEN_COST_PER_CHAT
): Promise<number> {
  const updated = await client.user.update({
    where: { id: userId },
    data: { tokens: { increment: amount } },
    select: { tokens: true },
  });

  logger.warn('[AI Tokens] Refunded tokens after failure', {
    userId,
    amount,
    remaining: updated.tokens,
  });
  return updated.tokens;
}
