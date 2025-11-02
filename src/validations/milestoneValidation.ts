import Joi from 'joi';

const milestoneValidation = {
  createMilestone: {
    body: Joi.object({
      name: Joi.string().min(2).max(150).required().messages({
        'string.empty': 'Milestone name is required',
        'string.min': 'Milestone name must be at least 2 characters',
        'string.max': 'Milestone name must not exceed 150 characters',
      }),
      description: Joi.string().max(500).optional().messages({
        'string.max': 'Description must not exceed 500 characters',
      }),
      xpReward: Joi.number().min(0).max(10000).optional().default(0).messages({
        'number.min': 'XP reward must be at least 0',
        'number.max': 'XP reward must not exceed 10000',
      }),
    }),
  },
  updateMilestone: {
    body: Joi.object({
      name: Joi.string().min(2).max(150).optional().messages({
        'string.min': 'Milestone name must be at least 2 characters',
        'string.max': 'Milestone name must not exceed 150 characters',
      }),
      description: Joi.string().max(500).optional().messages({
        'string.max': 'Description must not exceed 500 characters',
      }),
      xpReward: Joi.number().min(0).max(10000).optional().messages({
        'number.min': 'XP reward must be at least 0',
        'number.max': 'XP reward must not exceed 10000',
      }),
    }),
  },
};

export default milestoneValidation;
