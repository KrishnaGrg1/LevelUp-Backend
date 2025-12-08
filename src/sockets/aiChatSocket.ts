/**
 * AI Chat Socket Handler - Real-time streaming AI chat with token management
 */

import { Server } from 'socket.io';
import { AuthenticatedSocket } from '../middlewares/socketAuthMiddleware';
import client from '../helpers/prisma';
import OpenAIChat from '../helpers/ai/aiHelper';
import { getChatModerationPrompt } from '../helpers/ai/prompts';
import env from '../helpers/config';

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
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { tokens: true },
  });

  if (!user) {
    return { hasTokens: false, currentTokens: 0, required: 1 };
  }

  return {
    hasTokens: user.tokens > 0,
    currentTokens: user.tokens,
    required: 1,
  };
}

/**
 * Deduct token from user
 */
async function deductToken(userId: string): Promise<number> {
  const updatedUser = await client.user.update({
    where: { id: userId },
    data: { tokens: { decrement: 1 } },
    select: { tokens: true },
  });

  return updatedUser.tokens;
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
    console.log(`[AI Chat] History saved for user ${userId}`);
  } catch (error) {
    console.error('[AI Chat] Failed to save chat history:', error);
  }
}

/**
 * AI Chat Socket Handler
 */
export default function aiChatSocketHandler(io: Server, socket: AuthenticatedSocket) {
  
  /**
   * Event: 'ai-chat:check-tokens'
   * Check if user has tokens before starting chat
   */
  socket.on('ai-chat:check-tokens', async () => {
    try {
      if (!socket.user) {
        socket.emit('ai-chat:error', {
          code: 'AUTH_ERROR',
          message: 'Not authenticated',
        });
        return;
      }

      const tokenCheck = await checkUserTokens(socket.user.id);
      
      socket.emit('ai-chat:token-status', {
        hasTokens: tokenCheck.hasTokens,
        currentTokens: tokenCheck.currentTokens,
        costPerMessage: 1,
      });
    } catch (error) {
      console.error('[AI Chat] Token check error:', error);
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

    try {
      // Validate user authentication
      if (!socket.user) {
        socket.emit('ai-chat:error', {
          code: 'AUTH_ERROR',
          message: 'Not authenticated',
        });
        return;
      }

      const userId = socket.user.id;
      const { prompt, sessionId } = data;

      // Validate prompt
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

      // Check AI configuration
      if (!ensureAIConfigured()) {
        socket.emit('ai-chat:error', {
          code: 'AI_NOT_CONFIGURED',
          message: 'AI service is not available',
        });
        return;
      }

      // Check token balance
      const tokenCheck = await checkUserTokens(userId);
      if (!tokenCheck.hasTokens) {
        socket.emit('ai-chat:error', {
          code: 'INSUFFICIENT_TOKENS',
          message: 'You have run out of tokens',
          currentTokens: tokenCheck.currentTokens,
        });
        return;
      }

      // Emit start event
      socket.emit('ai-chat:start', {
        sessionId: sessionId || `session_${Date.now()}`,
        timestamp: new Date().toISOString(),
      });

      console.log(`[AI Chat] User ${socket.user.UserName} (${userId}) - Prompt: "${prompt.substring(0, 50)}..."`);

      // Build system prompt with moderation
      const systemPrompt = getChatModerationPrompt(prompt);

      // Call AI (you can implement streaming here if your AI helper supports it)
      const message = await OpenAIChat({ prompt: systemPrompt });
      responseText = message?.content ?? 'No response from AI';

      // Simulate streaming by chunking the response (optional enhancement)
      // If you want real streaming, you'll need to modify OpenAIChat to support it
      const chunkSize = 50;
      for (let i = 0; i < responseText.length; i += chunkSize) {
        const chunk = responseText.substring(i, i + chunkSize);
        socket.emit('ai-chat:chunk', {
          chunk,
          index: Math.floor(i / chunkSize),
        });
        // Small delay to simulate streaming (remove in production if real streaming is implemented)
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Deduct token after successful response
      const remainingTokens = await deductToken(userId);

      // Emit completion event
      socket.emit('ai-chat:complete', {
        sessionId,
        response: responseText,
        tokensUsed: 1,
        remainingTokens,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      // Save to history
      await saveChatHistory(userId, prompt, responseText, 1, sessionId, Date.now() - startTime);

      console.log(`[AI Chat] Response sent to ${socket.user.UserName} - Remaining tokens: ${remainingTokens}`);

    } catch (error: any) {
      console.error('[AI Chat] Error:', error);
      
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
    console.log(`[AI Chat] User ${socket.user?.UserName} cancelled session ${data.sessionId}`);
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
      if (!socket.user) {
        socket.emit('ai-chat:error', {
          code: 'AUTH_ERROR',
          message: 'Not authenticated',
        });
        return;
      }

      const user = await client.user.findUnique({
        where: { id: socket.user.id },
        select: { tokens: true },
      });

      socket.emit('ai-chat:tokens', {
        tokens: user?.tokens || 0,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AI Chat] Failed to fetch tokens:', error);
      socket.emit('ai-chat:error', {
        code: 'TOKEN_FETCH_ERROR',
        message: 'Failed to fetch token balance',
      });
    }
  });

  // Log AI chat connection
  if (socket.user) {
    console.log(`[AI Chat] ${socket.user.UserName} connected to AI chat`);
  }
}
