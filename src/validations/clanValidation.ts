import Joi from 'joi';

const clanValidation = {
  createClan: {
    body: Joi.object().keys({
      name: Joi.string().min(3).max(100).required().messages({
        'string.empty': 'Clan name is required',
        'string.min': 'Clan name must contain at least 3 characters',
        'string.max': 'Clan name must not exceed 100 characters',
      }),
      communityId: Joi.string().required().messages({
        'string.empty': 'Community ID is required',
      }),
      description: Joi.string().max(500).allow('').optional().messages({
        'string.max': 'Description must not exceed 500 characters',
      }),
      isPrivate: Joi.boolean().optional().messages({
        'boolean.base': 'isPrivate must be a boolean',
      }),
      limit: Joi.number().integer().min(1).max(1000).optional().messages({
        'number.base': 'Limit must be a number',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 1000',
      }),
    }),
  },

  joinClan: {
    body: Joi.object().keys({
      clanId: Joi.string().required().messages({
        'string.empty': 'Clan ID is required',
      }),
    }),
  },

  leaveClan: {
    body: Joi.object().keys({
      clanId: Joi.string().required().messages({
        'string.empty': 'Clan ID is required',
      }),
    }),
  },

  deleteClan: {
    params: Joi.object().keys({
      clanId: Joi.string().required().messages({
        'string.empty': 'Clan ID is required for deletion',
      }),
    }),
  },

  updateClan: {
    params: Joi.object().keys({
      clanId: Joi.string().required().messages({
        'string.empty': 'Clan ID is required to update',
      }),
    }),
    body: Joi.object().keys({
      name: Joi.string().min(3).max(100).optional().messages({
        'string.min': 'Clan name must contain at least 3 characters',
        'string.max': 'Clan name must not exceed 100 characters',
      }),
      description: Joi.string().max(500).optional().messages({
        'string.max': 'Description must not exceed 500 characters',
      }),
      isPrivate: Joi.boolean().optional().messages({
        'boolean.base': 'isPrivate must be a boolean',
      }),
      limit: Joi.number().integer().min(1).max(1000).optional().messages({
        'number.base': 'Limit must be a number',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 1000',
      }),
    }),
  },

  getClansByCommunity: {
    params: Joi.object().keys({
      communityId: Joi.string().required().messages({
        'string.empty': 'Community ID is required',
      }),
    }),
  },

  getClanMembers: {
    params: Joi.object().keys({
      clanId: Joi.string().required().messages({
        'string.empty': 'Clan ID is required to fetch members',
      }),
    }),
  },

  getClanInfo: {
    params: Joi.object().keys({
      clanId: Joi.string().required().messages({
        'string.empty': 'Clan ID is required to fetch info',
      }),
    }),
  },

  getUserClans: {
    params: Joi.object().keys({
      userId: Joi.string().required().messages({
        'string.empty': 'User ID is required to fetch user clans',
      }),
    }),
  },
};

export default clanValidation;
