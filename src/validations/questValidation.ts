import Joi from 'joi';

const questValidation = {
  generateQuests: {
    body: Joi.object({
      userSkillId: Joi.string().required().messages({
        'string.empty': 'UserSkill ID is required',
        'any.required': 'UserSkill ID is required',
      }),
      count: Joi.number().min(1).max(10).optional().default(3).messages({
        'number.min': 'Count must be at least 1',
        'number.max': 'Count must not exceed 10',
      }),
      type: Joi.string()
        .valid('Daily', 'Weekly', 'Monthly', 'OneTime')
        .optional()
        .default('Daily')
        .messages({
          'any.only': 'Type must be one of: Daily, Weekly, Monthly, OneTime',
        }),
    }),
  },
  completeQuest: {
    body: Joi.object({
      questId: Joi.string().required().messages({
        'string.empty': 'Quest ID is required',
        'any.required': 'Quest ID is required',
      }),
    }),
  },
  createManualQuest: {
    body: Joi.object({
      description: Joi.string().min(5).max(500).required().messages({
        'string.empty': 'Description is required',
        'string.min': 'Description must be at least 5 characters',
        'string.max': 'Description must not exceed 500 characters',
      }),
      xpValue: Joi.number().min(10).max(1000).required().messages({
        'number.base': 'XP value must be a number',
        'number.min': 'XP value must be at least 10',
        'number.max': 'XP value must not exceed 1000',
      }),
      type: Joi.string()
        .valid('Daily', 'Weekly', 'Monthly', 'OneTime')
        .optional()
        .default('Daily')
        .messages({
          'any.only': 'Type must be one of: Daily, Weekly, Monthly, OneTime',
        }),
      userSkillId: Joi.string().optional().messages({
        'string.base': 'UserSkill ID must be a string',
      }),
    }),
  },
  generateExtraQuest: {
    body: Joi.object({
      userSkillId: Joi.string().required().messages({
        'string.empty': 'userSkillId is required',
        'any.required': 'userSkillId is required',
      }),
    }),
  },
  deleteQuest: {
    params: Joi.object({
      id: Joi.string().required().messages({
        'string.empty': 'Quest ID is required',
      }),
    }),
  },
};

export default questValidation;
