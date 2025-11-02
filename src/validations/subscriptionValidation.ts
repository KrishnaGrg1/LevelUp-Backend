import Joi from 'joi';

const subscriptionValidation = {
  createSubscription: {
    body: Joi.object({
      plan: Joi.string()
        .valid('FREE', 'PRO', 'ULTRA')
        .required()
        .messages({
          'string.empty': 'Plan is required',
          'any.only': 'Plan must be one of: FREE, PRO, ULTRA',
        }),
      durationDays: Joi.number().min(1).max(365).optional().messages({
        'number.min': 'Duration must be at least 1 day',
        'number.max': 'Duration must not exceed 365 days',
      }),
    }),
  },
  updateSubscription: {
    body: Joi.object({
      plan: Joi.string()
        .valid('FREE', 'PRO', 'ULTRA')
        .optional()
        .messages({
          'any.only': 'Plan must be one of: FREE, PRO, ULTRA',
        }),
      expiresAt: Joi.date().optional().messages({
        'date.base': 'Expiry date must be a valid date',
      }),
    }),
  },
  upgrade: {
    body: Joi.object({
      plan: Joi.string().valid('PRO', 'ULTRA').required().messages({
        'string.empty': 'plan is required',
        'any.only': 'plan must be either PRO or ULTRA',
        'any.required': 'plan is required',
      }),
    }),
  },
};

export default subscriptionValidation;
