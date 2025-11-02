import { Response } from 'express';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Language } from '../translation/translation';
import client from '../helpers/prisma';
import OpenAIChat from '../helpers/ai/aiHelper';
import { deductTokens, TOKEN_COSTS } from '../helpers/tokenHelper';

/**
 * AI Chat endpoint (token-protected)
 * POST /ai/chat
 * Costs 3 tokens by default (ULTRA plan bypasses token deduction)
 */
const chat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    const { prompt } = req.body;

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

    // Get user and subscription
    const user = await client.user.findUnique({
      where: { id: userId },
      include: {
        subscription: true,
      },
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

    const isUltra = user.subscription?.plan === 'ULTRA';
    const tokenCost = TOKEN_COSTS.AI_CHAT;

    // Check tokens if not ULTRA
    if (!isUltra) {
      if (user.tokens < tokenCost) {
        // Create upsell trigger
        await client.upsellTrigger.create({
          data: {
            userId,
            type: 'insufficient_tokens_ai_chat',
            meta: {
              tokensNeeded: tokenCost,
              tokensAvailable: user.tokens,
            },
          },
        });

        res
          .status(403)
          .json(
            makeErrorResponse(
              new Error('Insufficient tokens'),
              'error.ai.insufficient_tokens',
              lang,
              403
            )
          );
        return;
      }

      // Deduct tokens
      await deductTokens(userId, tokenCost, 'AI Chat');
    } else {
      // Track ULTRA usage for analytics
      await client.upsellTrigger.create({
        data: {
          userId,
          type: 'ultra_ai_chat_usage',
          meta: {
            prompt: prompt.substring(0, 100),
          },
        },
      });
    }

    // Call OpenAI
    const aiResponse = await OpenAIChat({ prompt });

    res.status(200).json(
      makeSuccessResponse(
        {
          response: aiResponse.content,
          tokensUsed: isUltra ? 0 : tokenCost,
          tokensRemaining: isUltra ? 'unlimited' : user.tokens - tokenCost,
        },
        'success.ai.chat',
        lang,
        200
      )
    );
    return;
  } catch (e: unknown) {
    console.error('AI chat error:', e);
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to process AI chat'),
          'error.ai.failed',
          lang,
          500
        )
      );
    return;
  }
};

const aiController = {
  chat,
};

export default aiController;
