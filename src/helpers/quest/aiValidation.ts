/**
 * AI validation and timeout utilities for quest generation
 */

import env from '../config';
import OpenAIChat from '../ai/aiHelper';

/**
 * Check if AI is properly configured
 */
export function ensureAIConfigured(): boolean {
  const apiKey = env.OPENAI_API_KEY as string | undefined;
  const model = env.MODEL_NAME as string | undefined;
  return Boolean(apiKey && model);
}

/**
 * Call OpenAI with timeout protection
 */
export async function OpenAIChatWithTimeout(
  params: any,
  timeoutMs = 30000
): Promise<any> {
  return Promise.race([
    OpenAIChat(params),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI call timeout')), timeoutMs)
    ),
  ]);
}

/**
 * Validate AI response structure for quest generation
 */
export function validateQuestResponse(parsed: any): boolean {
  if (!parsed || typeof parsed !== 'object') return false;
  if (!Array.isArray(parsed.quests)) return false;

  return parsed.quests.every(
    (q: any) =>
      q &&
      typeof q.description === 'string' &&
      q.description.length > 0 &&
      q.description.length < 500 && // Reasonable max length
      (q.xpReward === undefined || typeof q.xpReward === 'number') &&
      (q.estimatedMinutes === undefined ||
        (typeof q.estimatedMinutes === 'number' &&
          q.estimatedMinutes >= 5 &&
          q.estimatedMinutes <= 20))
  );
}
