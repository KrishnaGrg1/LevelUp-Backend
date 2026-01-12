import Joi from 'joi';

const aiValidation = {
  chat: {
    body: Joi.object({
      prompt: Joi.string().min(1).max(4000).required(),
    }),
  },
  generateTrigger: {
    body: Joi.object({}).unknown(false),
  },
  startQuest: {
    body: Joi.object({
      questId: Joi.string().required(),
    }),
  },
  completeQuest: {
    body: Joi.object({
      questId: Joi.string().required(),
    }),
  },
  questId: {
    params: Joi.object({
      questId: Joi.string().required(),
    }),
  },
  completedQuests: {
    query: Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(100).optional(),
      type: Joi.string().valid('Daily', 'Weekly').optional(),
    }),
  },
  chatHistory: {
    query: Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(100).optional(),
      sessionId: Joi.string().optional(),
    }),
  },
  chatId: {
    params: Joi.object({
      chatId: Joi.string().required(),
    }),
  },
  deleteChatHistory: {
    query: Joi.object({
      all: Joi.string().valid('true', 'false').optional(),
    }),
  },
};

export default aiValidation;
