import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { makeErrorResponse, makeSuccessResponse } from '../helpers/standardResponse';
import { Language, translate } from '../translation/translation';
import OpenAIChat from '../helpers/ai/aiHelper';
import { getChatModerationPrompt } from '../helpers/ai/prompts';
import env from '../helpers/config';
import { MemberStatus } from '@prisma/client';
import client from '../helpers/prisma';
import { runDailyAiQuestForUser } from '../jobs/aiDailyQuests';
import { runWeeklyAiQuestForUser } from '../jobs/aiWeeklyQuests';

const ensureAIConfigured = () => {
  const apiKey = env.OPENAI_API_KEY as string | undefined;
  const model = env.MODEL_NAME as string | undefined;
  return Boolean(apiKey && model);
};

const chat = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const { prompt } = req.body as { prompt?: string };
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json(
        makeErrorResponse(new Error('Prompt is required'), 'error.ai.prompt_required', lang, 400)
      );
    }

    if (!ensureAIConfigured()) {
      return res.status(503).json(
        makeErrorResponse(new Error('AI not configured'), 'error.ai.not_configured', lang, 503)
      );
    }

    const systemPrompt = getChatModerationPrompt(prompt);
    if ((env.NODE_ENV as string) !== 'production') {
      console.debug(`[AI] chat request promptChars=${prompt.length} systemPromptChars=${systemPrompt.length}`);
    }
    // Check tokens
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json(
        makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401)
      );
    }

    const user = await (client as any).user.findUnique({ where: { id: userId }, select: { tokens: true } });
    if (!user || (user as any).tokens <= 0) {
      return res.status(402).json(
        makeErrorResponse(new Error('Insufficient tokens'), 'error.ai.insufficient_tokens', lang, 402)
      );
    }

    const message = await OpenAIChat({ prompt: systemPrompt });
    const reply = message?.content ?? translate('success.ai.no_response', lang);
    if ((env.NODE_ENV as string) !== 'production') {
      console.debug(`[AI] chat reply chars=${reply.length} preview="${reply.slice(0, 200).replace(/\s+/g, ' ')}"`);
    }
    // Deduct 1 token after successful call
    await (client as any).user.update({ where: { id: userId }, data: { tokens: { decrement: 1 } } });
    return res.status(200).json(makeSuccessResponse({ reply }, 'success.ai.chat', lang, 200));
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res.status(500).json(
      makeErrorResponse(new Error('AI chat failed'), 'error.ai.chat_failed', lang, 500)
    );
  }
};

const generateDailyQuests = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json(makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401));
    }
    await runDailyAiQuestForUser(userId);
    // Return today's grouped quests per community
    const today = await (client as any).quest.findMany({ where: { userId, type: 'Daily', periodStatus: 'TODAY' }, orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }] });
    return res.status(200).json(makeSuccessResponse({ today }, 'success.ai.quests_generated', lang, 200));
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res.status(500).json(makeErrorResponse(new Error('Failed to generate daily quests'), 'error.ai.generate_failed', lang, 500));
  }
};

const generateWeeklyQuests = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json(makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401));
    }
    await runWeeklyAiQuestForUser(userId);
    const thisWeek = await (client as any).quest.findMany({ where: { userId, type: 'Weekly', periodStatus: 'THIS_WEEK' }, orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }] });
    return res.status(200).json(makeSuccessResponse({ thisWeek }, 'success.ai.quests_generated', lang, 200));
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res.status(500).json(makeErrorResponse(new Error('Failed to generate weekly quests'), 'error.ai.generate_failed', lang, 500));
  }
};

const getDailyQuests = async (req: AuthRequest, res: Response) => {
  const lang = (req.language as Language) || 'eng';
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json(
      makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401)
    );
  }
  try {
    const [today, yesterday, dayBeforeYesterday] = await Promise.all([
      (client as any).quest.findMany({ where: { userId, type: 'Daily', periodStatus: 'TODAY' }, orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }] }),
      (client as any).quest.findMany({ where: { userId, type: 'Daily', periodStatus: 'YESTERDAY' }, orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }] }),
      (client as any).quest.findMany({ where: { userId, type: 'Daily', periodStatus: 'DAY_BEFORE_YESTERDAY' }, orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }] }),
    ]);
    return res.status(200).json(makeSuccessResponse({ today, yesterday, dayBeforeYesterday }, 'success.ai.quests_generated', lang, 200));
  } catch (e) {
    return res.status(500).json(makeErrorResponse(new Error('Failed to fetch daily quests'), 'error.ai.generate_failed', lang, 500));
  }
};

const getWeeklyQuests = async (req: AuthRequest, res: Response) => {
  const lang = (req.language as Language) || 'eng';
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json(
      makeErrorResponse(new Error('Not authenticated'), 'error.auth.not_authenticated', lang, 401)
    );
  }
  try {
    const [thisWeek, lastWeek, twoWeeksAgo] = await Promise.all([
      (client as any).quest.findMany({ where: { userId, type: 'Weekly', periodStatus: 'THIS_WEEK' }, orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }] }),
      (client as any).quest.findMany({ where: { userId, type: 'Weekly', periodStatus: 'LAST_WEEK' }, orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }] }),
      (client as any).quest.findMany({ where: { userId, type: 'Weekly', periodStatus: 'TWO_WEEKS_AGO' }, orderBy: [{ communityId: 'asc' }, { periodSeq: 'asc' }] }),
    ]);
    return res.status(200).json(makeSuccessResponse({ thisWeek, lastWeek, twoWeeksAgo }, 'success.ai.quests_generated', lang, 200));
  } catch (e) {
    return res.status(500).json(makeErrorResponse(new Error('Failed to fetch weekly quests'), 'error.ai.generate_failed', lang, 500));
  }
};

const health = async (req: AuthRequest, res: Response) => {
  const lang = (req.language as Language) || 'eng';
  const ok = ensureAIConfigured();
  if (!ok) {
    return res.status(503).json(
      makeErrorResponse(new Error('AI not configured'), 'error.ai.not_configured', lang, 503)
    );
  }
  return res.status(200).json(
    makeSuccessResponse({ configured: true }, 'success.ai.health', lang, 200)
  );
};

const config = async (req: AuthRequest, res: Response) => {
  const lang = (req.language as Language) || 'eng';
  const payload = {
    model: env.MODEL_NAME,
    maxPromptChars: 4000,
    maxGoalsPerRequest: 20,
    environment: env.NODE_ENV,
  };
  return res.status(200).json(
    makeSuccessResponse(payload, 'success.ai.config', lang, 200)
  );
};

const aiController = {
  chat,
  generateDailyQuests,
  generateWeeklyQuests,
  getDailyQuests,
  getWeeklyQuests,
  health,
  config,
};

export default aiController;