import { Response } from 'express';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Language } from '../translation/translation';
import client from '../helpers/prisma';

/**
 * Get current user's subscription
 */
const getMySubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;

    const subscription = await client.subscription.findUnique({
      where: { userId: userId as string },
    });

    if (!subscription) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Subscription not found'),
            'error.subscription.not_found',
            lang,
            404
          )
        );
      return;
    }

    res
      .status(200)
      .json(
        makeSuccessResponse(
          subscription,
          'success.subscription.fetch',
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
          new Error('Failed to fetch subscription'),
          'error.subscription.failed_to_fetch',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Create or update user subscription
 */
const updateSubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    const { plan, durationDays } = req.body;

    const existingSubscription = await client.subscription.findUnique({
      where: { userId: userId as string },
    });

    let expiresAt: Date | null = null;
    if (plan !== 'FREE' && durationDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + durationDays);
    }

    let subscription;
    if (existingSubscription) {
      subscription = await client.subscription.update({
        where: { userId: userId as string },
        data: {
          plan,
          ...(expiresAt && { expiresAt }),
        },
      });
    } else {
      subscription = await client.subscription.create({
        data: {
          userId: userId as string,
          plan,
          ...(expiresAt && { expiresAt }),
        },
      });
    }

    // Create upsell trigger if upgrading
    if (plan !== 'FREE') {
      await client.upsellTrigger.create({
        data: {
          userId: userId as string,
          type: 'SUBSCRIPTION_UPGRADE',
          meta: { plan, previousPlan: existingSubscription?.plan || 'FREE' },
        },
      });
    }

    res
      .status(200)
      .json(
        makeSuccessResponse(
          subscription,
          'success.subscription.updated',
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
          new Error('Failed to update subscription'),
          'error.subscription.failed_to_update',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Get user's daily streak
 */
const getMyStreak = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;

    let streak = await client.dailyStreak.findUnique({
      where: { userId: userId as string },
    });

    if (!streak) {
      // Create initial streak
      streak = await client.dailyStreak.create({
        data: {
          userId: userId as string,
          count: 0,
        },
      });
    }

    res
      .status(200)
      .json(makeSuccessResponse(streak, 'success.streak.fetch', lang, 200));
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to fetch streak'),
          'error.streak.failed_to_fetch',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Get user's token balance
 */
const getMyTokens = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;

    const user = await client.user.findUnique({
      where: { id: userId as string },
      select: { tokens: true },
    });

    if (!user) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('User not found'),
            'error.auth.user_not_found',
            lang,
            404
          )
        );
      return;
    }

    res
      .status(200)
      .json(
        makeSuccessResponse(
          { tokens: user.tokens },
          'success.tokens.fetch',
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
          new Error('Failed to fetch tokens'),
          'error.tokens.failed_to_fetch',
          lang,
          500
        )
      );
    return;
  }
};

/**
 * Upgrade subscription (payment placeholder)
 * POST /subscription/upgrade
 */
const upgradeSubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    const { plan } = req.body;

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

    // Pricing (example)
    const pricing = {
      PRO: { monthly: 9.99, annually: 99.99 },
      ULTRA: { monthly: 19.99, annually: 199.99 },
    };

    // TODO: Integrate with Stripe/Razorpay here
    // For now, return a payment session placeholder
    const paymentSession = {
      sessionId: `session_${Date.now()}_${userId}`,
      plan,
      amount: pricing[plan as 'PRO' | 'ULTRA'].monthly,
      currency: 'USD',
      status: 'pending',
      // In production, this would be:
      // - Stripe checkout URL
      // - Razorpay order ID
      // - Or other payment provider details
      paymentUrl: `https://payment-provider.com/checkout?session=${Date.now()}`,
      instructions:
        'PLACEHOLDER: Integrate with real payment provider (Stripe/Razorpay)',
    };

    // On simulated success path (in production, this would be a webhook handler)
    // For demo purposes, we'll simulate immediate success
    const simulateSuccess = req.query.simulate === 'true';

    if (simulateSuccess) {
      // Calculate expiry (30 days for monthly)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Upsert subscription
      const subscription = await client.subscription.upsert({
        where: { userId },
        create: {
          userId,
          plan,
          expiresAt,
        },
        update: {
          plan,
          expiresAt,
        },
      });

      res.status(200).json(
        makeSuccessResponse(
          {
            subscription,
            message: 'Subscription upgraded successfully (SIMULATED)',
          },
          'success.subscription.upgraded',
          lang,
          200
        )
      );
      return;
    }

    res.status(200).json(
      makeSuccessResponse(
        paymentSession,
        'success.subscription.payment_session_created',
        lang,
        200
      )
    );
    return;
  } catch (e: unknown) {
    console.error('Upgrade subscription error:', e);
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to upgrade subscription'),
          'error.subscription.failed_to_upgrade',
          lang,
          500
        )
      );
    return;
  }
};

const subscriptionController = {
  getMySubscription,
  updateSubscription,
  getMyStreak,
  getMyTokens,
  upgradeSubscription,
};

export default subscriptionController;
