import cron from 'node-cron';
import prisma from '../helpers/prisma';
import { getDailyTokenRefill } from '../helpers/tokenHelper';
import { SubscriptionPlan } from '@prisma/client';

/**
 * Daily Token Refill Cron Job
 * Runs every day at 00:00 UTC
 * Refills tokens for all users based on their subscription plan:
 * - FREE: 50 tokens/day
 * - PRO: 200 tokens/day
 * - ULTRA: unlimited (set to high number for simplicity)
 */
export function scheduleDailyTokenRefill() {
  // Run at 00:00 UTC every day
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Starting daily token refill...');
    
    try {
      // Get all users with their subscriptions
      const users = await prisma.user.findMany({
        select: {
          id: true,
          tokens: true,
          subscription: {
            select: {
              plan: true,
            },
          },
        },
      });

      let refillCount = 0;
      let errorCount = 0;

      for (const user of users) {
        try {
          const plan = user.subscription?.plan || SubscriptionPlan.FREE;
          const refillAmount = getDailyTokenRefill(plan);

          // Refill tokens (set to daily amount, not add)
          await prisma.user.update({
            where: { id: user.id },
            data: { tokens: refillAmount }
          });

          refillCount++;
          console.log(`[CRON] Refilled ${refillAmount} tokens for user ${user.id} (${plan})`);
        } catch (error) {
          errorCount++;
          console.error(`[CRON] Failed to refill tokens for user ${user.id}:`, error);
        }
      }

      console.log(`[CRON] Daily token refill complete: ${refillCount} refilled, ${errorCount} errors`);
    } catch (error) {
      console.error('[CRON] Daily token refill failed:', error);
    }
  });

  console.log('[CRON] Daily token refill scheduled (00:00 UTC)');
}
