import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { makeErrorResponse, makeSuccessResponse } from '../helpers/standardResponse';
import { Language, translate } from '../translation/translation';
import OpenAIChat from '../helpers/ai/aiHelper';
import { getChatModerationPrompt, getDailyQuestPrompt, getExtraQuestPrompt } from '../helpers/ai/prompts';
import env from '../helpers/config';
import { MemberStatus } from '@prisma/client';

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
    const message = await OpenAIChat({ prompt: systemPrompt });
    const reply = message?.content ?? translate('success.ai.no_response', lang);
    if ((env.NODE_ENV as string) !== 'production') {
      console.debug(`[AI] chat reply chars=${reply.length} preview="${reply.slice(0, 200).replace(/\s+/g, ' ')}"`);
    }
    return res.status(200).json(makeSuccessResponse({ reply }, 'success.ai.chat', lang, 200));
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res.status(500).json(
      makeErrorResponse(new Error('AI chat failed'), 'error.ai.chat_failed', lang, 500)
    );
  }
};

const generateQuests = async (req: AuthRequest, res: Response) => {
  try {
    const lang = (req.language as Language) || 'eng';
    const {
      goals,
      difficulty,
      count,
      level = 1,
      status = 'Beginner',
      xp = 0,
      type = 'daily',
    } = req.body as {
      goals: string[];
      difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
      count?: number;
      level?: number;
      status?: MemberStatus | 'Beginner' | 'Intermediate' | 'Advanced';
      xp?: number;
      type?: 'daily' | 'extra';
    };

    if (!Array.isArray(goals) || goals.length === 0) {
      return res.status(400).json(
        makeErrorResponse(new Error('Goals are required'), 'error.ai.goals_required', lang, 400)
      );
    }

    if (!ensureAIConfigured()) {
      return res.status(503).json(
        makeErrorResponse(new Error('AI not configured'), 'error.ai.not_configured', lang, 503)
      );
    }

    const safeCount = Math.min(Math.max(Number(count) || 3, 1), 20);
    if ((env.NODE_ENV as string) !== 'production') {
      console.debug(
        `[AI] generate request goals=${goals.length} difficulty=${difficulty} type=${type} level=${level} status=${status} xp=${xp} count=${safeCount}`
      );
    }
    const skills = goals.slice(0, safeCount);
    const prompts = skills.map((skill) =>
      type === 'extra'
        ? getExtraQuestPrompt(skill, level, status as MemberStatus, xp)
        : getDailyQuestPrompt(skill, level, status as MemberStatus, xp)
    );
    const results = await Promise.allSettled(
      prompts.map(async (p, i) => {
        if ((env.NODE_ENV as string) !== 'production') {
          console.debug(`[AI] generate prompt skill="${skills[i]}" chars=${p.length}`);
        }
        const message = await OpenAIChat({ prompt: p });
        return { index: i, content: message?.content ?? '{}' };
      })
    );

    const quests: Array<{ description: string; xpReward: number; skill: string }> = results.map((res) => {
      const i = (res as any).value?.index ?? (res as any).reason?.index ?? 0;
      const skill = skills[i] ?? goals[i] ?? 'skill';
      const defaultXp = difficulty === 'Advanced' ? 50 : difficulty === 'Intermediate' ? 30 : 15;
      if (res.status === 'fulfilled') {
        const content = res.value.content as string;
        try {
          const parsed = JSON.parse(content);
          if ((env.NODE_ENV as string) !== 'production') {
            console.debug(`[AI] generate parsed ok skill="${skill}" descChars=${String(parsed.description ?? '').length}`);
          }
          return {
            description: String(parsed.description ?? 'No description'),
            xpReward: Number(parsed.xpReward ?? defaultXp),
            skill,
          };
        } catch {
          const tpl = translate('success.ai.fallback_description', lang);
          const desc = tpl.replace('{skill}', skill).replace('{difficulty}', String(difficulty));
          if ((env.NODE_ENV as string) !== 'production') {
            console.debug(`[AI] generate parse failed, used fallback for skill="${skill}"`);
          }
          return { description: desc, xpReward: defaultXp, skill };
        }
      } else {
        const tpl = translate('success.ai.fallback_description', lang);
        const desc = tpl.replace('{skill}', skill).replace('{difficulty}', String(difficulty));
        if ((env.NODE_ENV as string) !== 'production') {
          console.debug(`[AI] generate error, used fallback for skill="${skill}"`);
        }
        return { description: desc, xpReward: defaultXp, skill };
      }
    });

    return res
      .status(200)
      .json(makeSuccessResponse({ quests }, 'success.ai.quests_generated', lang, 200));
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    return res.status(500).json(
      makeErrorResponse(new Error('Failed to generate quests'), 'error.ai.generate_failed', lang, 500)
    );
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
  generateQuests,
  health,
  config,
};

export default aiController;