import Joi from 'joi';

const communityValidation = {
  createCommunity: {
    body: Joi.object().keys({
      communityName: Joi.string().min(3).max(150).required().messages({
        'string.empty': 'Community Name is required',
        'string.min': 'Username must contain altleast 3 characters long',
        'string.max': 'Username mustnot exceed 150 characters long',
      }),
      isPrivate: Joi.boolean()
        .truthy('true')
        .truthy('1')
        .truthy('yes')
        .falsy('false')
        .falsy('0')
        .falsy('no')
        .messages({
          'boolean.base': 'isPrivate must be a boolean',
        }),

      memberLimit: Joi.number().integer().min(1).max(1000).optional().messages({
        'number.base': 'Member limit must be a number',
        'number.min': 'Member limit must be at least 1',
        'number.max': 'Member limit cannot exceed 1000',
      }),
      description: Joi.string().max(500).optional().messages({
        'string.max': 'Description must not exceed 500 characters long',
      }),
    }),
  },

  joinWithCodeCommunity: {
    body: Joi.object().keys({
      joinCode: Joi.string().min(3).max(150).required().messages({
        'string.empty': 'Join code is required',
        'string.min': 'Join code must contain at least 3 characters long',
        'string.max': 'Join code must not exceed 150 characters long',
      }),
    }),
  },
  getAllCommunities: {
    query: Joi.object().keys({
      page: Joi.number().integer().min(1).optional().messages({
        'number.base': 'Page must be a number',
        'number.min': 'Page must be at least 1',
      }),
      limit: Joi.number().integer().min(1).max(100).optional().messages({
        'number.base': 'Limit must be a number',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100',
      }),
      q: Joi.string().max(200).optional().messages({
        'string.max': 'Search query must not exceed 200 characters',
      }),
    }),
  },

  getCommunityOwner: {
    params: Joi.object().keys({
      communityId: Joi.string().min(3).max(150).required().messages({
        'string.empty': 'Community ID is required',
        'string.min': 'Community ID must contain at least 3 characters long',
        'string.max': 'Community ID must not exceed 150 characters long',
      }),
    }),
  },

  getInviteCode: {
    params: Joi.object().keys({
      communityId: Joi.string().min(3).max(150).required().messages({
        'string.empty': 'Community ID is required',
        'string.min': 'Community ID must contain at least 3 characters long',
        'string.max': 'Community ID must not exceed 150 characters long',
      }),
    }),
  },

  joinPublicCommunity: {
    params: Joi.object().keys({
      communityId: Joi.string().min(3).max(150).required().messages({
        'string.empty': 'Community ID is required',
        'string.min': 'Community ID must contain at least 3 characters long',
        'string.max': 'Community ID must not exceed 150 characters long',
      }),
    }),
  },

  leaveCommunity: {
    params: Joi.object().keys({
      communityId: Joi.string().min(3).max(150).required().messages({
        'string.empty': 'Community ID is required',
        'string.min': 'Community ID must contain at least 3 characters long',
        'string.max': 'Community ID must not exceed 150 characters long',
      }),
    }),
  },

  transferOwnership: {
    body: Joi.object().keys({
      newOwnerId: Joi.string()
        .min(3)
        .max(150)

        .required()
        .messages({
          'string.empty': 'New Owner ID is required',
          'string.min': 'New Owner ID must contain at least 3 characters long',
          'string.max': 'New Owner ID must not exceed 150 characters long',
        }),
    }),
  },
  updateCommunity: {
    params: Joi.object().keys({
      communityId: Joi.string().min(3).max(150).required().messages({
        'string.empty': 'Community ID is required',
        'string.min': 'Community ID must contain at least 3 characters long',
        'string.max': 'Community ID must not exceed 150 characters long',
      }),
    }),
    body: Joi.object().keys({
      name: Joi.string().min(3).max(150).optional().messages({
        'string.min': 'Community Name must contain at least 3 characters long',
        'string.max': 'Community Name must not exceed 150 characters long',
      }),
      description: Joi.string().max(500).optional().messages({
        'string.max': 'Description must not exceed 500 characters long',
      }),
      isPrivate: Joi.boolean().optional().messages({
        'boolean.base': 'isPrivate must be a boolean',
      }),
      memberLimit: Joi.number().integer().min(1).max(1000).optional().messages({
        'number.base': 'Member limit must be a number',
        'number.min': 'Member limit must be at least 1',
        'number.max': 'Member limit cannot exceed 1000',
      }),
    }),
  },
};

export default communityValidation;
