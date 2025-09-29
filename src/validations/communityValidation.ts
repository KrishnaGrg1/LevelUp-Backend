import Joi from 'joi';

const communityValidation = {
  createCommunity: {
    body: Joi.object().keys({
      communityName: Joi.string().min(3).max(150).required().messages({
        'string.empty': 'Community Name is required',
        'string.min': 'Username must contain altleast 3 characters long',
        'string.max': 'Username mustnot exceed 150 characters long',
      }),
      isPrivate: Joi.boolean().messages({
        'boolean.base': 'isPrivate must be a boolean',
      }),

      memberLimit: Joi.number().integer().min(1).max(1000).optional().messages({
        'number.base': 'Member limit must be a number',
        'number.min': 'Member limit must be at least 1',
        'number.max': 'Member limit cannot exceed 1000',
      }),
    }),
  },

  joinCommunity: {
    body: Joi.object().keys({
      communityName: Joi.string().min(3).max(150).required().messages({
        'string.empty': 'Community Name is required',
        'string.min': 'Username must contain altleast 3 characters long',
        'string.max': 'Username mustnot exceed 150 characters long',
      }),
    }),
  },
};

export default communityValidation;
