/**
 * AI Chat Socket Handler - Real-time streaming AI chat with token management
 */

import { Server } from 'socket.io';
import { AuthenticatedSocket } from '../middlewares/socketAuthMiddleware';
import client from '../helpers/prisma';
import OpenAIChat from '../helpers/ai/aiHelper';
import { getChatModerationPrompt } from '../helpers/ai/prompts';
import env from '../helpers/config';
import logger from '../helpers/logger';
import { checkAuthentication, emitSocketError } from '../helpers/socketResponse';
import {
  consumeTokens,
  refundTokens,
  getTokenCostPerChat,
  getTokenBalance,
} from '../helpers/ai/tokenService';

interface AIChatMessage {
  prompt: string;
  sessionId?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface TokenCheckResponse {
  hasTokens: boolean;
  currentTokens: number;
  required: number;
}

/**
 * Check if AI is properly configured
 */
function ensureAIConfigured(): boolean {
  const apiKey = env.OPENAI_API_KEY as string | undefined;
  const model = env.MODEL_NAME as string | undefined;
  return Boolean(apiKey && model);
}

/**
 * Check user token balance
 */
async function checkUserTokens(userId: string): Promise<TokenCheckResponse> {
  const cost = getTokenCostPerChat();
  const tokens = await getTokenBalance(userId);

  return {
    hasTokens: tokens >= cost,
    currentTokens: tokens,
    required: cost,
  };
}

/**
 * Save chat history to database
 */
async function saveChatHistory(
  userId: string,
  prompt: string,
  response: string,
  tokensUsed: number,
  sessionId?: string,
  responseTime?: number
): Promise<void> {
  try {
    await client.aIChatHistory.create({
      data: {
        userId,
        sessionId,
        prompt,
        response,
        tokensUsed,
        responseTime,
      },
    });
    logger.info('[AI Chat] History saved', { userId, sessionId, tokensUsed, responseTime });
  } catch (error) {
    logger.error('[AI Chat] Failed to save chat history', error, { userId, sessionId });
  }
}

export default function aiChatSocketHandler(io: Server, socket: AuthenticatedSocket) {
  
  socket.on('ai-chat:check-tokens', async () => {
    try {
      if (!checkAuthentication(socket)) return;

      const tokenCheck = await checkUserTokens(socket.user.id);
      
      socket.emit('ai-chat:token-status', {
        hasTokens: tokenCheck.hasTokens,
        currentTokens: tokenCheck.currentTokens,
        costPerMessage: tokenCheck.required,
      });
    } catch (error) {
      logger.error('[AI Chat] Token check error', error, { socketId: socket.id, userId: socket.user?.id });
      socket.emit('ai-chat:error', {
        code: 'TOKEN_CHECK_ERROR',
        message: 'Failed to check token balance',
      });
    }
  });

  /**
   * Event: 'ai-chat:send'
   * Send a message to AI and stream the response
   */
  socket.on('ai-chat:send', async (data: AIChatMessage) => {
    const startTime = Date.now();
    let responseText = '';
    let tokensDebited = false;
    const tokenCost = getTokenCostPerChat();
    let userId: string | null = null;

    try {
      if (!checkAuthentication(socket)) return;

      userId = socket.user.id;
      const { prompt, sessionId } = data;

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        socket.emit('ai-chat:error', {
          code: 'INVALID_PROMPT',
          message: 'Prompt is required and must be a non-empty string',
        });
        return;
      }

      if (prompt.length > 4000) {
        socket.emit('ai-chat:error', {
          code: 'PROMPT_TOO_LONG',
          message: 'Prompt must be less than 4000 characters',
        });
        return;
      }

      if (!ensureAIConfigured()) {
        socket.emit('ai-chat:error', {
          code: 'AI_NOT_CONFIGURED',
          message: 'AI service is not available',
        });
        return;
      }

      const consumeResult = await consumeTokens(userId, tokenCost);
      if (!consumeResult.ok) {
        socket.emit('ai-chat:error', {
          code: 'INSUFFICIENT_TOKENS',
          message: 'You have run out of tokens',
          currentTokens: consumeResult.remainingTokens,
        });
        return;
      }
      tokensDebited = true;

      socket.emit('ai-chat:start', {
        sessionId: sessionId || `session_${Date.now()}`,
        timestamp: new Date().toISOString(),
      });

      logger.info('[AI Chat] Prompt received', { username: socket.user.UserName, userId, promptPreview: prompt.substring(0, 50) });

      const systemPrompt = getChatModerationPrompt(prompt);

      const message = await OpenAIChat({ prompt: systemPrompt });
      responseText = message?.content ?? 'No response from AI';

      const chunkSize = 50;
      for (let i = 0; i < responseText.length; i += chunkSize) {
        const chunk = responseText.substring(i, i + chunkSize);
        socket.emit('ai-chat:chunk', {
          chunk,
          index: Math.floor(i / chunkSize),
        });
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const remainingTokens = consumeResult.remainingTokens;

      // Emit completion event
      socket.emit('ai-chat:complete', {
        sessionId,
        response: responseText,
        tokensUsed: tokenCost,
        remainingTokens,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      // Save to history
      await saveChatHistory(userId, prompt, responseText, tokenCost, sessionId, Date.now() - startTime);

      logger.info('[AI Chat] Response sent', { username: socket.user.UserName, userId, remainingTokens });

    } catch (error: any) {
      logger.error('[AI Chat] Error', error, { socketId: socket.id, userId: socket.user?.id, sessionId: data.sessionId });
      if (tokensDebited) {
        try {
          if (userId) {
            await refundTokens(userId, tokenCost);
          }
        } catch (refundError) {
          logger.error('[AI Chat] Failed to refund tokens', refundError, { userId: socket.user?.id });
        }
      }
      
      socket.emit('ai-chat:error', {
        code: 'CHAT_FAILED',
        message: error?.message || 'Failed to process AI chat',
        sessionId: data.sessionId,
      });

      // Emit partial response if we got any
      if (responseText) {
        socket.emit('ai-chat:complete', {
          sessionId: data.sessionId,
          response: responseText,
          tokensUsed: 0, // Don't deduct if failed
          partial: true,
          error: true,
        });
      }
    }
  });

  /**
   * Event: 'ai-chat:cancel'
   * Cancel an ongoing AI chat request
   */
  socket.on('ai-chat:cancel', (data: { sessionId: string }) => {
    logger.info('[AI Chat] Session cancelled', { username: socket.user?.UserName, userId: socket.user?.id, sessionId: data.sessionId });
    socket.emit('ai-chat:cancelled', {
      sessionId: data.sessionId,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Event: 'ai-chat:get-tokens'
   * Get current token balance
   */
  socket.on('ai-chat:get-tokens', async () => {
    try {
      if (!checkAuthentication(socket)) return;

      const tokens = await getTokenBalance(socket.user.id);

      socket.emit('ai-chat:tokens', {
        tokens,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[AI Chat] Failed to fetch tokens', error, { socketId: socket.id, userId: socket.user?.id });
      socket.emit('ai-chat:error', {
        code: 'TOKEN_FETCH_ERROR',
        message: 'Failed to fetch token balance',
      });
    }
  });

  // Log AI chat connection
  if (socket.user) {
    logger.info('[AI Chat] User connected', { username: socket.user.UserName, userId: socket.user.id, socketId: socket.id });
  }
}
