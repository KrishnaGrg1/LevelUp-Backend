import Joi from 'joi';

const getCommunityMessages = {
  params: Joi.object({
    communityId: Joi.string().required()
  }),
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional()
  })
};

const getClanMessages = {
  params: Joi.object({
    clanId: Joi.string().required()
  }),
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional()
  })
};

export default {
  getCommunityMessages,
  getClanMessages
};